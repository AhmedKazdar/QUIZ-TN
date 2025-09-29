import { Injectable, Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Quiz } from './schemas/quiz.schema';

export interface QuizSession {
  id: string;
  quizId: string;
  hostId: string;
  status: 'waiting' | 'in_progress' | 'finished';
  currentQuestionIndex: number;
  timePerQuestion: number;
  timeRemaining: number;
  participants: {
    userId: string;
    socketId: string;
    score: number;
    answers: { questionIndex: number; answer: number; isCorrect: boolean }[];
    isEliminated: boolean;
  }[];
  questions: any[];
  startTime: Date;
  timer: NodeJS.Timeout;
}

@Injectable()
export class QuizSessionService {
  private readonly logger = new Logger(QuizSessionService.name);
  private activeSessions: Map<string, QuizSession> = new Map();
  private server: Server | null = null;

  constructor(
    @InjectModel(Quiz.name) private quizModel: Model<Quiz>,
  ) {}

  setServer(server: Server): void {
    this.server = server;
  }

  async createSession(quizId: string, hostId: string, socketId: string): Promise<QuizSession> {
    const quiz = await this.quizModel.findById(quizId).lean().exec();
    if (!quiz) {
      throw new Error('Quiz not found');
    }

    // Cast to any to handle the document type
    const quizObj = quiz as any;

    const session: QuizSession = {
      id: Math.random().toString(36).substr(2, 9),
      quizId,
      hostId,
      status: 'waiting',
      currentQuestionIndex: -1,
      timePerQuestion: 30, // Default time per question in seconds
      timeRemaining: 0,
      participants: [{
        userId: hostId,
        socketId,
        score: 0,
        answers: [],
        isEliminated: false,
      }],
      questions: quizObj.questions || [],
      startTime: new Date(),
      timer: undefined as unknown as NodeJS.Timeout,
    };

    this.activeSessions.set(session.id, session);
    this.logger.log(`Session ${session.id} created for quiz ${quizId}`);
    return session;
  }

  joinSession(sessionId: string, userId: string, socketId: string): QuizSession {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    const existingParticipant = session.participants.find(p => p.userId === userId);
    if (!existingParticipant) {
      session.participants.push({
        userId,
        socketId,
        score: 0,
        answers: [],
        isEliminated: false,
      });
      this.logger.log(`User ${userId} joined session ${sessionId}`);
    } else {
      // Update socket ID if reconnecting
      existingParticipant.socketId = socketId;
      this.logger.log(`User ${userId} reconnected to session ${sessionId}`);
    }

    return session;
  }

  startQuiz(sessionId: string): QuizSession {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    session.status = 'in_progress';
    session.currentQuestionIndex = 0;
    this.startQuestionTimer(session);
    this.broadcastSessionUpdate(session);
    return session;
  }

  submitAnswer(sessionId: string, userId: string, answer: number): QuizSession {
    const session = this.activeSessions.get(sessionId);
    if (!session || session.status !== 'in_progress') {
      throw new Error('Session not active');
    }

    const participant = session.participants.find(p => p.userId === userId);
    if (!participant || participant.isEliminated) {
      throw new Error('Participant not found or eliminated');
    }

    const currentQuestion = session.questions[session.currentQuestionIndex];
    const isCorrect = currentQuestion.correctAnswer === answer;

    participant.answers.push({
      questionIndex: session.currentQuestionIndex,
      answer,
      isCorrect,
    });

    if (isCorrect) {
      participant.score += 10; // Award points for correct answer
    } else {
      participant.isEliminated = true;
      this.emitToParticipant(participant.socketId, 'eliminated', {
        questionIndex: session.currentQuestionIndex,
        correctAnswer: currentQuestion.correctAnswer,
      });
    }

    this.broadcastScores(session);
    return session;
  }

  private startQuestionTimer(session: QuizSession): void {
    if (session.timer) {
      clearTimeout(session.timer);
    }

    session.timeRemaining = session.timePerQuestion;
    
    session.timer = setInterval(() => {
      session.timeRemaining--;
      
      this.emitToSession(session.id, 'timeUpdate', {
        timeRemaining: session.timeRemaining,
        questionIndex: session.currentQuestionIndex
      });

      if (session.timeRemaining <= 0) {
        clearInterval(session.timer);
        this.handleTimeUp(session);
      }
    }, 1000);
  }

  private handleTimeUp(session: QuizSession): void {
    // Mark participants who didn't answer as eliminated
    session.participants.forEach(participant => {
      if (!participant.isEliminated) {
        const answered = participant.answers.some(
          a => a.questionIndex === session.currentQuestionIndex
        );
        
        if (!answered) {
          participant.isEliminated = true;
          this.emitToParticipant(participant.socketId, 'eliminated', {
            questionIndex: session.currentQuestionIndex,
            timeUp: true
          });
        }
      }
    });

    // Move to next question or end quiz
    if (session.currentQuestionIndex < session.questions.length - 1) {
      session.currentQuestionIndex++;
      this.startQuestionTimer(session);
    } else {
      this.endQuiz(session);
    }

    this.broadcastSessionUpdate(session);
  }

  private endQuiz(session: QuizSession): void {
    clearInterval(session.timer);
    session.status = 'finished';
    this.emitToSession(session.id, 'quizEnded', {
      scores: session.participants.map(p => ({
        userId: p.userId,
        score: p.score,
        isEliminated: p.isEliminated
      }))
    });
  }

  private broadcastSessionUpdate(session: QuizSession): void {
    this.emitToSession(session.id, 'sessionUpdate', {
      status: session.status,
      currentQuestionIndex: session.currentQuestionIndex,
      timeRemaining: session.timeRemaining,
      participants: session.participants.map(p => ({
        userId: p.userId,
        score: p.score,
        isEliminated: p.isEliminated
      }))
    });
  }

  private broadcastScores(session: QuizSession): void {
    this.emitToSession(session.id, 'scoresUpdate', {
      scores: session.participants.map(p => ({
        userId: p.userId,
        score: p.score,
        isEliminated: p.isEliminated
      }))
    });
  }

  private emitToSession(sessionId: string, event: string, data: any): void {
    if (this.server) {
      this.server.to(sessionId).emit(event, data);
    }
  }

  private emitToParticipant(socketId: string, event: string, data: any): void {
    if (this.server) {
      this.server.to(socketId).emit(event, data);
    }
  }

  getSession(sessionId: string): QuizSession | undefined {
    return this.activeSessions.get(sessionId);
  }

  removeSession(sessionId: string): void {
    const session = this.activeSessions.get(sessionId);
    if (session?.timer) {
      clearInterval(session.timer);
    }
    this.activeSessions.delete(sessionId);
    this.logger.log(`Session ${sessionId} removed`);
  }

  removeParticipant(sessionId: string, userId: string): void {
    const session = this.activeSessions.get(sessionId);
    if (!session) return;

    session.participants = session.participants.filter(p => p.userId !== userId);
    
    // If host leaves, end the session
    if (session.hostId === userId) {
      this.emitToSession(sessionId, 'hostDisconnected', {});
      this.removeSession(sessionId);
    } else if (session.participants.length === 0) {
      // If no participants left, clean up the session
      this.removeSession(sessionId);
    } else {
      this.broadcastSessionUpdate(session);
    }
  }

  removeParticipantFromAllSessions(userId: string): void {
    const sessionsToUpdate: string[] = [];
    
    // First, collect all session IDs that need to be updated
    for (const [sessionId, session] of this.activeSessions.entries()) {
      if (session.participants.some(p => p.userId === userId)) {
        sessionsToUpdate.push(sessionId);
      }
    }
    
    // Then update each session
    for (const sessionId of sessionsToUpdate) {
      this.removeParticipant(sessionId, userId);
    }
  }
}
