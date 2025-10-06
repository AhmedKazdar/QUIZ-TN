import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription, Observable, interval } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { QuestionService, Question } from '../../services/api/question.service';
import { ScoreService } from '../../services/api/score.service';
import { SocketService, OnlineUser } from '../../services/socket.service';

interface Score {
  _id: string;
  userId: string;
  score: number;
  correctAnswers: number;
  totalQuestions: number;
  timeSpent: number;
  createdAt: string;
  updatedAt: string;
}

@Component({
  selector: 'app-quiz',
  templateUrl: './quiz.component.html',
  styleUrls: ['./quiz.component.scss'],
})
export class QuizComponent implements OnInit, OnDestroy {
  /*** State ***/
  questions: Question[] = [];
  currentQuestionIndex = 0;
  answers: (number | null)[] = [];
  selectedAnswer: number | null = null;

  quizStarted = false;
  quizFinished = false;
  watchMode = false;
  quizResult: Score | null = null;

  loading = false;
  error: string | null = null;
  mode: 'solo' | 'online' = 'solo';
  modeFromRoute = false;

  /*** Timers & Progress ***/
  questionTimeLimit = 15;
  totalTime = 0;
  timeRemaining = 15;
  progress = 0;
  waitingForAnswer = false;
  answerWaitTime = 10;

  /*** User ***/
  isAuthenticated = false;
  currentUserId: string | null = null;

  /*** Winner & Game Over State ***/
  gameWinner: { userId: string; username: string } | null = null;
  gameOver = false;
  isWinner = false;

  /*** Answer Feedback ***/
  showAnswerFeedback = false;
  currentCorrectAnswerIndex: number | null = null;

  /*** Internals ***/
  private quizSubscription: Subscription | null = null;
  private timerSubscription: Subscription | null = null;
  private answerWaitTimer: any = null;
  private quizStartTime = 0;
  private questionStartTime = 0;
  private quizId = 'online-quiz-' + Date.now();
  private socketSubscriptions = new Subscription();
  private routeSubscription: Subscription | null = null;
  onlineUsers: OnlineUser[] = [];
  isSocketConnected = false;
  private emergencyFallbackTimeout: any = null;

  /*** Online Mode Specific ***/
  private onlineQuestionsQueue: { [key: number]: Question } = {};
  private currentOnlineQuestion: Question | null = null;
  private totalOnlineQuestions = 10;
  private waitingForNextQuestion = false;

  constructor(
    private authService: AuthService,
    private questionService: QuestionService,
    private scoreService: ScoreService,
    private router: Router,
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef,
    private socketService: SocketService
  ) {
    this.isAuthenticated = this.authService.isAuthenticated();
    this.currentUserId = this.authService.currentUserValue?._id || null;
  }

  /* ------------------- Lifecycle ------------------- */
  ngOnInit(): void {
    this.routeSubscription = this.route.params.subscribe((params) => {
      let mode = params['mode'] as 'solo' | 'online' | undefined;

      if (!mode) {
        const path = this.route.snapshot.routeConfig?.path || '';
        if (path.includes('quiz/solo')) mode = 'solo';
        else if (path.includes('quiz/online')) mode = 'online';
      }

      if (mode === 'solo' || mode === 'online') {
        this.mode = mode;
        this.modeFromRoute = true;
        this.initializeQuiz();
      } else {
        this.router.navigate(['/home']);
      }
    });
  }

  ngOnDestroy(): void {
    this.cleanupSubscriptions();
    if (this.answerWaitTimer) clearInterval(this.answerWaitTimer);
    if (this.emergencyFallbackTimeout) clearTimeout(this.emergencyFallbackTimeout);

    try {
      this.socketSubscriptions.unsubscribe();
    } catch (e) {}

    this.routeSubscription?.unsubscribe();
  }

  /* ------------------- Navigation ------------------- */
  navigateToHome(): void {
    this.router.navigate([this.isAuthenticated ? '/home' : '/']);
  }

  restartQuiz(): void {
    this.quizStarted = false;
    this.quizFinished = false;
    this.quizResult = null;
    this.currentQuestionIndex = 0;
    this.answers = [];
    this.selectedAnswer = null;
    this.progress = 0;
    this.error = null;
    this.watchMode = false;
    this.gameWinner = null;
    this.gameOver = false;
    this.isWinner = false;
    this.showAnswerFeedback = false;
    this.currentCorrectAnswerIndex = null;
    this.loading = true;

    this.onlineQuestionsQueue = {};
    this.currentOnlineQuestion = null;
    this.waitingForNextQuestion = false;

    if (this.mode === 'solo') {
      this.questionService.getQuestions(10).subscribe({
        next: (questions: Question[]) => {
          this.questions = questions || [];
          this.answers = new Array(this.questions.length).fill(null);
          this.totalTime = this.questions.length * 30;
          this.timeRemaining = this.totalTime;
          this.quizStarted = true;
          this.loading = false;
          this.quizStartTime = Date.now();
          this.startTimer(this.totalTime);
          this.cdr.detectChanges();
        },
        error: (error) => {
          console.error('Failed to load questions:', error);
          this.loading = false;
          this.error = 'Failed to load questions. Please try again.';
          this.quizStarted = false;
          this.cdr.detectChanges();
        },
      });
    } else {
      this.startQuiz('online');
    }
  }

  /* ------------------- Quiz Flow ------------------- */
  private initializeQuiz(): void {
    if (this.mode === 'online' && !this.isAuthenticated) {
      this.router.navigate(['/login'], { queryParams: { returnUrl: '/quiz/online' } });
      return;
    }

    if (this.mode === 'online') {
      this.setupSocketListeners();
    }

    this.startQuiz(this.mode);
  }

  private setupSocketListeners(): void {
    this.socketService.connect();

    try {
      this.socketSubscriptions.unsubscribe();
    } catch (e) {}
    this.socketSubscriptions = new Subscription();

    const usersSub = this.socketService.getOnlineUsers().subscribe((users) => {
      this.onlineUsers = users || [];
      console.log('👥 Online users updated:', this.onlineUsers.length);
      this.cdr.detectChanges();
    });

    const statusSub = this.socketService.getConnectionStatus().subscribe((connected) => {
      const wasConnected = this.isSocketConnected;
      this.isSocketConnected = connected;

      if (connected && !wasConnected) {
        setTimeout(() => this.socketService.requestOnlineUsers(), 300);
      }
    });

    const newQuestionSub = this.socketService.onNewQuestion().subscribe((data: any) => {
      console.log('📝 Received new question from server:', data);
      this.handleNewQuestion(data);
    });

    const winnerDeterminedSub = this.socketService.onWinnerDetermined().subscribe((data: any) => {
      console.log('🎉 Winner determined received in component:', data);

      if (this.emergencyFallbackTimeout) {
        clearTimeout(this.emergencyFallbackTimeout);
        this.emergencyFallbackTimeout = null;
      }

      this.handleGameOver(data?.winner);
    });

    const playerEliminatedSub = this.socketService.onPlayerEliminated().subscribe((data: any) => {
      if (data?.userId === this.currentUserId) return;
      console.log(`❌ Player ${data?.userId} was eliminated: ${data?.reason}`);
    });

    const playerAnsweredSub = this.socketService.onPlayerAnswered().subscribe((data: any) => {
      if (data?.userId === this.currentUserId) return;
      console.log(`📝 Player ${data?.userId} answered question ${data?.questionIndex} correctly: ${data?.isCorrect}`);
    });

    const playerWinSub = this.socketService.onPlayerWin().subscribe((data: any) => {
      if (data?.userId === this.currentUserId) return;
      console.log(`🏆 Player ${data?.username} won the game!`);
      this.handleOtherPlayerWin(data);
    });

    const gameOverSub = this.socketService.onGameOver().subscribe((data: any) => {
      console.log('🛑 Game over event received:', data);
      this.handleGameOver(data?.winner);
    });

    const playerReadySub = this.socketService.onPlayerReady().subscribe((data: any) => {
      console.log(`✅ Player ${data?.username} is ready for question ${data?.questionIndex}`);
    });

    this.socketSubscriptions.add(usersSub);
    this.socketSubscriptions.add(statusSub);
    this.socketSubscriptions.add(newQuestionSub);
    this.socketSubscriptions.add(winnerDeterminedSub);
    this.socketSubscriptions.add(playerEliminatedSub);
    this.socketSubscriptions.add(playerAnsweredSub);
    this.socketSubscriptions.add(playerWinSub);
    this.socketSubscriptions.add(gameOverSub);
    this.socketSubscriptions.add(playerReadySub);
  }

  private handleNewQuestion(data: any): void {
    if (this.mode !== 'online') return;

    const { question, questionIndex, totalQuestions } = data || {};

    console.log(`🔄 Processing question ${questionIndex} of ${totalQuestions}`);

    if (typeof totalQuestions === 'number') {
      this.totalOnlineQuestions = totalQuestions;
    }

    if (!question || typeof questionIndex !== 'number') {
      console.warn('handleNewQuestion: invalid payload', data);
      return;
    }

    if (!this.questions) this.questions = [];
    if (!this.answers) this.answers = [];

    if (questionIndex === this.currentQuestionIndex) {
      this.questions[questionIndex] = question;
      this.answers[questionIndex] = null;
      this.currentOnlineQuestion = question;
      this.loading = false;
      this.waitingForNextQuestion = false;

      console.log(`✅ Loaded current question ${questionIndex}`);

      this.timeRemaining = this.questionTimeLimit;
      this.questionStartTime = Date.now();
      this.startTimer(this.questionTimeLimit);
    } else if (questionIndex > this.currentQuestionIndex) {
      this.onlineQuestionsQueue[questionIndex] = question;
      console.log(`📥 Queued question ${questionIndex} for later`);
    }

    this.updateProgress();
    this.cdr.detectChanges();
  }

  private handleOtherPlayerWin(winnerData: any): void {
    this.error = `${winnerData?.username || 'A player'} answered the final question correctly!`;
    this.cdr.detectChanges();
  }

  private handleGameOver(winner: { userId: string; username: string } | null): void {
    if (this.gameOver) return;

    console.log('🎯 Handling game over with winner:', winner);

    this.gameOver = true;
    this.gameWinner = winner;
    this.isWinner = !!(winner && winner.userId === this.currentUserId);

    this.stopTimer();

    const timeSpent = Math.max(1, Math.floor((Date.now() - this.quizStartTime) / 1000));

    this.calculateLocalScore(timeSpent).subscribe({
      next: (score) => {
        if (!score || !Number.isFinite(score.score)) {
          this.handleEmergencyFallback(timeSpent);
          return;
        }

        this.quizResult = { ...score, timeSpent };
        this.quizFinished = true;
        this.quizStarted = false;
        this.loading = false;

        if (!winner) {
          this.error = "Game Over! It's a draw - no winner this round.";
        } else {
          this.error = null;
        }

        console.log('✅ Quiz completed successfully');
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error calculating score:', err);
        this.handleEmergencyFallback(timeSpent);
      },
    });

    this.scrollToTop();
  }

  private handleEmergencyFallback(timeSpent: number): void {
    const totalQ = this.questions?.length || 0;
    const correctCount = this.answers
      ? this.answers.filter((a, i) => a !== null && a !== -1 && this.questions[i]?.options?.[a]?.isCorrect).length
      : 0;

    const fallbackScore: Score = {
      _id: 'emergency-' + Date.now(),
      userId: this.currentUserId || 'anonymous',
      score: totalQ ? Math.round((correctCount / totalQ) * 100) : 0,
      correctAnswers: correctCount,
      totalQuestions: totalQ,
      timeSpent,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.quizResult = fallbackScore;
    this.quizFinished = true;
    this.quizStarted = false;
    this.loading = false;
    this.cdr.detectChanges();
  }

  startQuiz(mode: 'solo' | 'online' = 'solo'): void {
    this.mode = mode;
    this.loading = true;
    this.quizStarted = true;
    this.quizFinished = false;
    this.quizResult = null;
    this.currentQuestionIndex = 0;
    this.answers = [];
    this.selectedAnswer = null;
    this.progress = 0;
    this.error = null;
    this.gameWinner = null;
    this.gameOver = false;
    this.isWinner = false;
    this.showAnswerFeedback = false;
    this.currentCorrectAnswerIndex = null;
    this.quizStartTime = Date.now();

    this.onlineQuestionsQueue = {};
    this.currentOnlineQuestion = null;
    this.waitingForNextQuestion = false;
    this.totalOnlineQuestions = 10;

    this.loadQuestions();
  }

  private loadQuestions(): void {
    if (this.mode === 'solo') {
      this.questionService.getQuestions(10).subscribe({
        next: (questions) => {
          this.questions = questions || [];
          this.answers = new Array(this.questions.length).fill(null);
          this.totalTime = this.questions.length * 30;
          this.timeRemaining = this.totalTime;
          this.startTimer(this.totalTime);
          this.loading = false;
          console.log('✅ Solo mode: All questions loaded:', this.questions.length);
          this.cdr.detectChanges();
        },
        error: () => {
          this.loading = false;
          this.error = 'Failed to load questions. Please try again.';
          this.quizStarted = false;
          this.cdr.detectChanges();
        },
      });
    } else {
      // Online mode: request ALL questions at once
      this.loading = true;
      console.log('🔄 Online mode: Requesting all questions...');
  
      // Initialize arrays
      this.questions = [];
      this.answers = [];
  
      // Request all questions from server via socket
      if (this.socketService.isConnected()) {
        this.socketService.emitRequestQuestions({
          quizId: this.quizId,
          count: 10
        });
  
        // Listen for the questions loaded event
        const questionsSub = this.socketService.onQuestionsLoaded().subscribe((data: any) => {
          if (data.questions && Array.isArray(data.questions)) {
            this.questions = data.questions;
            this.answers = new Array(this.questions.length).fill(null);
            this.totalOnlineQuestions = this.questions.length;
            this.loading = false;
            
            console.log(`✅ Online mode: All ${this.questions.length} consistent questions loaded`);
            
            // Start with first question
            this.timeRemaining = this.questionTimeLimit;
            this.questionStartTime = Date.now();
            this.startTimer(this.questionTimeLimit);
            
            this.cdr.detectChanges();
          }
        });
  
        this.socketSubscriptions.add(questionsSub);
  
        // Fallback timeout
        setTimeout(() => {
          if (this.loading && this.questions.length === 0) {
            console.log('⏰ Fallback: Loading questions from API...');
            this.loadFallbackQuestions();
          }
        }, 5000);
      } else {
        this.loadFallbackQuestions();
      }
    }
  }


  private loadFallbackQuestions(): void {
    console.log('🔄 Loading fallback questions...');
    this.questionService.getQuestions(10).subscribe({
      next: (questions) => {
        if (questions && questions.length > 0) {
          this.questions = questions;
          this.answers = new Array(this.questions.length).fill(null);
          this.totalOnlineQuestions = this.questions.length;
          this.loading = false;
          
          console.log(`✅ Fallback: ${this.questions.length} questions loaded`);
          this.startTimer(this.questionTimeLimit);
          this.cdr.detectChanges();
        } else {
          this.loading = false;
          this.error = 'Failed to load questions. Please try again.';
          this.quizStarted = false;
          this.cdr.detectChanges();
        }
      },
      error: () => {
        this.loading = false;
        this.error = 'Failed to load questions. Please try again.';
        this.quizStarted = false;
        this.cdr.detectChanges();
      },
    });
  }

  private loadFallbackQuestion(questionIndex: number): void {
    console.log(`🔄 Loading fallback question ${questionIndex}...`);
    this.questionService.getSingleQuestion().subscribe({
      next: (question) => {
        if (question) {
          this.handleNewQuestion({
            question,
            questionIndex,
            totalQuestions: 10,
          });
        } else {
          this.loading = false;
          this.error = 'Failed to load question. Please try again.';
          this.quizStarted = false;
          this.cdr.detectChanges();
        }
      },
      error: () => {
        this.loading = false;
        this.error = 'Failed to load question. Please try again.';
        this.quizStarted = false;
        this.cdr.detectChanges();
      },
    });
  }

  private requestNextQuestion(): void {
    const nextQuestionIndex = this.currentQuestionIndex + 1;

    if (nextQuestionIndex >= this.totalOnlineQuestions) {
      console.log('🎯 Reached maximum questions');
      return;
    }

    console.log(`🔄 Requesting next question ${nextQuestionIndex}...`);

    if (this.onlineQuestionsQueue[nextQuestionIndex]) {
      console.log(`✅ Using queued question ${nextQuestionIndex}`);
      const queuedQuestion = this.onlineQuestionsQueue[nextQuestionIndex];
      this.questions[nextQuestionIndex] = queuedQuestion;
      this.answers[nextQuestionIndex] = null;
      this.currentOnlineQuestion = queuedQuestion;
      delete this.onlineQuestionsQueue[nextQuestionIndex];

      this.timeRemaining = this.questionTimeLimit;
      this.questionStartTime = Date.now();
      this.startTimer(this.questionTimeLimit);

      return;
    }

    this.waitingForNextQuestion = true;
    this.loading = true;

    if (this.socketService.isConnected()) {
      this.socketService.emitRequestQuestion({
        quizId: this.quizId,
        questionIndex: nextQuestionIndex,
      });

      this.socketService.emitReadyForNextQuestion({
        quizId: this.quizId,
        userId: this.currentUserId || '',
        questionIndex: nextQuestionIndex,
      });

      setTimeout(() => {
        if (this.waitingForNextQuestion && !this.questions[nextQuestionIndex]) {
          console.log('⏰ Fallback: Loading next question from API...');
          this.loadFallbackQuestion(nextQuestionIndex);
        }
      }, 5000);
    } else {
      this.loadFallbackQuestion(nextQuestionIndex);
    }
  }

  /* ------------------- Timer Logic ------------------- */
  private startTimer(duration: number): void {
    this.stopTimer();
    this.timeRemaining = duration;
  
    this.timerSubscription = interval(1000).subscribe(() => {
      if (this.gameOver) {
        this.stopTimer();
        return;
      }
  
      if (this.mode === 'online') {
        this.timeRemaining--;
  
        if (this.timeRemaining <= 0) {
          this.stopTimer();
  
          const isLastQuestion = this.currentQuestionIndex === this.totalOnlineQuestions - 1;
  
          if (isLastQuestion) {
            console.log('⏰ Final question time expired - determining winner immediately');
            this.handleFinalQuestionTimeExpired();
          } else {
            this.handleRegularQuestionTimeExpired();
          }
        }
      } else {
        // Solo mode timer logic remains the same
        this.timeRemaining--;
        if (this.timeRemaining <= 0) {
          this.stopTimer();
          this.nextQuestion();
        }
      }
  
      this.updateProgress();
      this.cdr.detectChanges();
    });
  }

  private immediateFallbackDetermineWinner(): void {
    if (this.gameOver) return;

    console.log('🔧 Using immediate fallback winner determination');

    if (this.emergencyFallbackTimeout) {
      clearTimeout(this.emergencyFallbackTimeout);
      this.emergencyFallbackTimeout = null;
    }

    const playerAnswered = this.answers?.[this.currentQuestionIndex] !== null && this.answers?.[this.currentQuestionIndex] !== undefined;
    let playerCorrect = false;

    if (playerAnswered) {
      const current = this.questions?.[this.currentQuestionIndex];
      const selectedAnswer = this.answers[this.currentQuestionIndex];

      if (current && selectedAnswer !== null && selectedAnswer !== undefined) {
        playerCorrect = !!current.options?.[selectedAnswer]?.isCorrect;
      }
    }

    if (playerCorrect && !this.watchMode) {
      console.log('🎯 Current player wins - they answered correctly');
      this.declareWinner();
    } else {
      console.log('👥 Another player wins or draw');
      const random = Math.random();

      if (random < 0.7) {
        this.simulateOtherPlayerWin();
      } else {
        this.handleGameOver(null);
      }
    }
  }

  private simulateOtherPlayerWin(): void {
    if (this.gameOver) return;

    console.log('🤖 Simulating other player win');

    const otherPlayers = ['QuizMaster', 'Brainiac', 'Champion', 'ProPlayer'];
    const randomWinner = otherPlayers[Math.floor(Math.random() * otherPlayers.length)];

    this.handleGameOver({ userId: 'other-player-' + Date.now(), username: randomWinner });
  }

  private forceEmergencyEnd(): void {
    if (this.gameOver) return;

    console.log('🚨 EMERGENCY: Forcing game end');
    this.gameOver = true;
    this.stopTimer();

    const timeSpent = Math.max(1, Math.floor((Date.now() - this.quizStartTime) / 1000));

    const emergencyScore: Score = {
      _id: 'emergency-' + Date.now(),
      userId: this.currentUserId || 'anonymous',
      score: 50,
      correctAnswers: Math.floor((this.questions?.length || 0) / 2),
      totalQuestions: this.questions?.length || 0,
      timeSpent,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.quizResult = emergencyScore;
    this.quizFinished = true;
    this.quizStarted = false;
    this.loading = false;
    this.error = 'Quiz completed - results may be incomplete';

    console.log('🚨 Game forced to end');
    this.cdr.detectChanges();
    this.scrollToTop();
  }

  private determineWinnerOnTimeExpired(): void {
    if (this.gameOver) return;

    console.log('🎯 Starting winner determination process');

    this.error = null;

    this.emergencyFallbackTimeout = setTimeout(() => {
      if (!this.gameOver) {
        console.log('🚨 EMERGENCY: Forcing game end due to timeout');
        this.forceEmergencyEnd();
      }
    }, 5000);

    if (this.mode === 'online' && this.socketService.isConnected()) {
      console.log('📡 Waiting for server to determine winner...');
      this.socketService.emitDetermineWinner({ quizId: this.quizId, questionIndex: this.currentQuestionIndex });
    } else {
      console.log('🔧 Using immediate fallback determination');
      this.immediateFallbackDetermineWinner();
    }
  }

  private handleFinalQuestionTimeExpired(): void {
    this.debugGameState('Final Question Time Expired');
    console.log('⏰ Final question time expired - determining winner');

    if (this.emergencyFallbackTimeout) {
      clearTimeout(this.emergencyFallbackTimeout);
      this.emergencyFallbackTimeout = null;
    }

    if (this.watchMode) {
      console.log('👀 Watch mode - determining winner');
      this.determineWinnerOnTimeExpired();
      return;
    }

    const playerAnswered = this.answers?.[this.currentQuestionIndex] !== null && this.answers?.[this.currentQuestionIndex] !== undefined;
    let playerCorrect = false;

    if (playerAnswered) {
      const current = this.questions?.[this.currentQuestionIndex];
      const selectedAnswer = this.answers[this.currentQuestionIndex];

      if (current && selectedAnswer !== null && selectedAnswer !== undefined) {
        playerCorrect = !!current.options?.[selectedAnswer]?.isCorrect;
      }
    }

    if (playerCorrect) {
      console.log('🎯 Player answered correctly on final question - immediate win');
      this.declareWinner();
    } else {
      console.log('❌ Player did not answer correctly - determining winner');
      this.determineWinnerOnTimeExpired();
    }
  }

  private handleRegularQuestionTimeExpired(): void {
    const playerAnswered = this.answers?.[this.currentQuestionIndex] !== null && this.answers?.[this.currentQuestionIndex] !== undefined;

    if (this.watchMode) {
      console.log('👀 Watch mode - time expired, revealing correct answer');
      this.error = "Time's up! Revealing correct answer...";

      setTimeout(() => {
        if (this.currentQuestionIndex < this.totalOnlineQuestions - 1) {
          this.nextQuestion();
        } else {
          this.submitQuiz();
        }
      }, 2000);
    } else {
      if (playerAnswered) {
        const current = this.questions?.[this.currentQuestionIndex];
        const selectedAnswer = this.answers[this.currentQuestionIndex];

        if (current && selectedAnswer !== null && selectedAnswer !== undefined) {
          const isCorrect = !!current.options?.[selectedAnswer]?.isCorrect;

          if (!isCorrect) {
            this.eliminatePlayer("Wrong answer! You've been eliminated.");

            if (this.socketService.isConnected() && this.currentUserId) {
              this.socketService.emitPlayerAnswered({ userId: this.currentUserId, questionIndex: this.currentQuestionIndex, isCorrect: false });
            }
          } else {
            if (this.socketService.isConnected() && this.currentUserId) {
              this.socketService.emitPlayerAnswered({ userId: this.currentUserId, questionIndex: this.currentQuestionIndex, isCorrect: true });
            }
          }
        }
      } else {
        this.answers[this.currentQuestionIndex] = -1;
        this.eliminatePlayer("Time's up! You've been eliminated for not answering.");
      }

      setTimeout(() => {
        if (this.currentQuestionIndex < this.totalOnlineQuestions - 1) {
          this.nextQuestion();
        }
      }, 2000);
    }
  }

  private stopTimer(): void {
    try {
      this.timerSubscription?.unsubscribe();
    } catch (e) {}
    this.timerSubscription = null;
  }

  private updateProgress(): void {
    if (!this.questions?.length) {
      this.progress = 0;
      return;
    }
  
    if (this.mode === 'online') {
      // For online mode, calculate progress based on current question
      this.progress = Math.round(((this.currentQuestionIndex + 1) / this.totalOnlineQuestions) * 100);
    } else {
      // Solo mode: calculate based on time
      const elapsed = this.totalTime - this.timeRemaining;
      this.progress = this.totalTime ? Math.min(100, Math.round((elapsed / this.totalTime) * 100)) : 0;
    }
  }

  private debugGameState(context: string): void {
    console.log('=== GAME STATE DEBUG:', context, '===');
    console.log('Game Over:', this.gameOver);
    console.log('Quiz Finished:', this.quizFinished);
    console.log('Quiz Started:', this.quizStarted);
    console.log('Current Question:', this.currentQuestionIndex + 1, 'of', this.totalOnlineQuestions);
    console.log('Watch Mode:', this.watchMode);
    console.log('Winner:', this.gameWinner);
    console.log('Is Winner:', this.isWinner);
    console.log('Time Remaining:', this.timeRemaining);
    console.log('Current Answer:', this.answers?.[this.currentQuestionIndex]);
    console.log('Questions in queue:', Object.keys(this.onlineQuestionsQueue || {}).length);
    console.log('Waiting for next question:', this.waitingForNextQuestion);
    console.log('========================');
  }

  private eliminatePlayer(reason: string): void {
    if (this.watchMode) return;

    this.watchMode = true;
    this.error = reason;

    if (this.socketService.isConnected() && this.currentUserId) {
      this.socketService.emitPlayerEliminated({ userId: this.currentUserId, questionIndex: this.currentQuestionIndex, reason });
    }

    this.cdr.detectChanges();
  }

  /* ------------------- Navigation Between Questions ------------------- */
  nextQuestion(): void {
    if (!this.questions?.length) return;
  
    // Reset answer feedback state
    this.showAnswerFeedback = false;
    this.currentCorrectAnswerIndex = null;
    this.selectedAnswer = null;
    this.error = null;
  
    if (this.currentQuestionIndex < this.totalOnlineQuestions - 1) {
      this.currentQuestionIndex++;
      this.updateProgress();
  
      if (this.mode === 'online') {
        // For online mode, we already have all questions, just start timer
        this.timeRemaining = this.questionTimeLimit;
        this.questionStartTime = Date.now();
        this.startTimer(this.questionTimeLimit);
      }
  
      this.selectedAnswer = this.answers[this.currentQuestionIndex];
      this.scrollToTop();
    } else {
      this.submitQuiz();
    }
  }

  previousQuestion(): void {
    if (this.currentQuestionIndex > 0) {
      this.currentQuestionIndex--;
      this.updateProgress();
      this.selectedAnswer = this.answers[this.currentQuestionIndex];
      this.scrollToTop();
    }
  }

  goToQuestion(index: number): void {
    if (index >= 0 && index < (this.questions?.length || 0)) {
      this.currentQuestionIndex = index;
      this.selectedAnswer = this.answers[this.currentQuestionIndex];
      this.scrollToTop();
    }
  }

  /* ------------------- Answer Handling ------------------- */
  selectAnswer(index: number): void {
    if (this.watchMode || this.answers?.[this.currentQuestionIndex] !== null || this.gameOver) return;

    this.selectedAnswer = index;
    this.answers[this.currentQuestionIndex] = index;

    const current = this.questions?.[this.currentQuestionIndex];
    const isCorrect = !!current?.options?.[index]?.isCorrect;

    this.currentCorrectAnswerIndex = current?.options?.findIndex(opt => opt.isCorrect) ?? null;

    if (this.mode === 'online') {
      const isLastQuestion = this.currentQuestionIndex === this.totalOnlineQuestions - 1;

      if (isCorrect) {
        if (isLastQuestion) {
          console.log('🎯 Correct answer on final question - immediate win!');
          this.declareWinner();
          return;
        } else {
          if (this.socketService.isConnected() && this.currentUserId) {
            this.socketService.emitPlayerAnswered({ userId: this.currentUserId, questionIndex: this.currentQuestionIndex, isCorrect: true });
          }
          this.error = null;
        }
      } else {
        const isLastQuestion = this.currentQuestionIndex === this.totalOnlineQuestions - 1;

        if (isLastQuestion) {
          console.log('❌ Wrong answer on final question - immediate elimination');
          this.eliminatePlayer('Wrong answer on final question! Game over.');
        } else {
          if (this.socketService.isConnected() && this.currentUserId) {
            this.socketService.emitPlayerAnswered({ userId: this.currentUserId, questionIndex: this.currentQuestionIndex, isCorrect: false });
          }
        }
      }
    } else {
      // SOLO MODE: Show immediate feedback
      this.showAnswerFeedback = true;
      
      setTimeout(() => {
        this.showAnswerFeedback = false;
        this.currentCorrectAnswerIndex = null;
        
        if (this.currentQuestionIndex < this.questions.length - 1) {
          this.nextQuestion();
        } else {
          this.submitQuiz();
        }
      }, 1500);
    }
    
    this.cdr.detectChanges();
  }

  private declareWinner(): void {
    if (this.gameOver || !this.currentUserId) return;

    this.gameOver = true;
    this.isWinner = true;

    const currentUser = this.authService.currentUserValue;
    const winnerData = {
      userId: this.currentUserId,
      username: currentUser?.username || 'Unknown Player',
    };

    this.gameWinner = winnerData;

    this.stopTimer();

    if (this.socketService.isConnected()) {
      this.socketService.emitPlayerWin({ userId: this.currentUserId, username: winnerData.username, questionIndex: this.currentQuestionIndex });
      this.socketService.emitGameOver({ winner: winnerData });
    }

    const timeSpent = Math.max(1, Math.floor((Date.now() - this.quizStartTime) / 1000));
    this.calculateLocalScore(timeSpent).subscribe({
      next: (score) => {
        this.quizResult = { ...score, timeSpent };
        this.quizFinished = true;
        this.quizStarted = false;
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        const fallback: Score = {
          _id: 'local-' + Date.now(),
          userId: this.currentUserId || 'anonymous',
          score: 100,
          correctAnswers: this.questions?.length || 0,
          totalQuestions: this.questions?.length || 0,
          timeSpent,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        this.quizResult = fallback;
        this.quizFinished = true;
        this.quizStarted = false;
        this.loading = false;
        this.cdr.detectChanges();
      },
    });

    this.scrollToTop();
  }

  /* ------------------- Helpers ------------------- */
  private calculateLocalScore(timeSpent: number): Observable<Score> {
    return new Observable((observer) => {
      try {
        const total = this.questions?.length || 0;
        const correct = this.questions?.reduce((acc, q, i) => {
          const sel = this.answers?.[i];
          return sel !== null && sel !== undefined && sel !== -1 && q.options?.[sel]?.isCorrect ? acc + 1 : acc;
        }, 0) || 0;

        const result: Score = {
          _id: 'local-' + Date.now(),
          userId: this.currentUserId || 'anonymous',
          score: total ? Math.round((correct / total) * 100) : 0,
          correctAnswers: correct,
          totalQuestions: total,
          timeSpent,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        observer.next(result);
        observer.complete();
      } catch (err) {
        observer.error(err);
      }
    });
  }

  /* ------------------- UI Utilities ------------------- */
  continueWatching(): void {
    this.error = null;
    if (this.currentQuestionIndex < this.totalOnlineQuestions - 1) {
      this.nextQuestion();
    } else {
      this.submitQuiz();
    }
  }

  submitQuiz(): void {
    if (this.quizFinished || this.loading) return;
    this.loading = true;
    this.stopTimer();

    const timeSpent = Math.max(1, Math.floor((Date.now() - this.quizStartTime) / 1000));

    this.calculateLocalScore(timeSpent).subscribe({
      next: (score) => this.finishQuizWithScore(score, timeSpent),
      error: () => {
        const fallback: Score = {
          _id: 'local-' + Date.now(),
          userId: this.currentUserId || 'anonymous',
          score: 0,
          correctAnswers: 0,
          totalQuestions: this.questions?.length || 0,
          timeSpent,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        this.finishQuizWithScore(fallback, timeSpent);
        this.error = 'Error calculating final score. Showing partial results.';
      },
    });
  }

  private finishQuizWithScore(score: Score, timeSpent: number): void {
    this.quizResult = { ...score, timeSpent };
    this.quizFinished = true;
    this.quizStarted = false;
    this.loading = false;
    this.stopTimer();

    if (this.mode === 'online' && this.currentUserId) {
      this.saveScore(score, timeSpent);
    }

    this.scrollToTop();
    this.cdr.detectChanges();
  }

  private saveScore(score: Score, timeSpent: number): void {
    if (!this.currentUserId) return;

    const scoreData = {
      userId: this.currentUserId,
      quizId: this.quizId,
      score: score.score,
      correctAnswers: score.correctAnswers,
      totalQuestions: score.totalQuestions,
      timeSpent,
      answers: this.answers?.map((a, i) => ({
        questionId: this.questions?.[i]?._id || '',
        selectedOption: a,
        isCorrect: this.questions?.[i]?.options?.[a ?? -1]?.isCorrect || false,
      })) || [],
    };

    this.scoreService.saveScore(scoreData).subscribe({
      next: (res) => console.log('✅ Score saved:', res),
      error: (err) => console.error('❌ Error saving score:', err),
    });
  }

  private scrollToTop(): void {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  private cleanupSubscriptions(): void {
    try {
      this.quizSubscription?.unsubscribe();
    } catch (e) {}
    try {
      this.timerSubscription?.unsubscribe();
    } catch (e) {}
    try {
      this.socketSubscriptions?.unsubscribe();
    } catch (e) {}
  }

  /* ------------------- UI Utilities ------------------- */
  getScoreClass(score: number): string {
    if (score >= 80) return 'score-excellent';
    if (score >= 50) return 'score-good';
    return 'score-poor';
  }

  getLetter(index: number): string {
    return String.fromCharCode(65 + index);
  }
  

  get totalQuestionsCount(): number {
    if (this.mode === 'online') {
      return this.totalOnlineQuestions;
    }
    return this.questions?.length || 0;
  }
  
  get currentProgress(): number {
    if (!this.questions?.length) return 0;
    
    if (this.mode === 'online') {
      return Math.round(((this.currentQuestionIndex + 1) / this.totalOnlineQuestions) * 100);
    }
    return Math.round(((this.currentQuestionIndex + 1) / this.questions.length) * 100);
  }
  
  get ariaValueMax(): number {
    if (this.mode === 'online') {
      return this.totalOnlineQuestions;
    }
    return this.questions?.length || 0;
  }
  startAnswerWaitTimer(callback: () => void): void {
    if (this.answerWaitTimer) clearInterval(this.answerWaitTimer);
    this.waitingForAnswer = true;
    this.answerWaitTime = 30;

    this.answerWaitTimer = setInterval(() => {
      this.answerWaitTime--;
      if (this.answerWaitTime <= 0) {
        this.waitingForAnswer = false;
        clearInterval(this.answerWaitTimer);
        this.answerWaitTimer = null;
        callback();
      }
      this.cdr.detectChanges();
    }, 1000);
  }

  isQuizCompletedSuccessfully(): boolean {
    if (!this.quizResult) return false;
    const incorrect = this.quizResult.totalQuestions - this.quizResult.correctAnswers;
    return incorrect === 0 || (incorrect === 1 && this.quizResult.correctAnswers === 0);
  }

  get currentQuestion(): Question | null {
    return this.questions[this.currentQuestionIndex] || null;
  }

  get hasCurrentQuestion(): boolean {
    return !!this.questions[this.currentQuestionIndex];
  }

  get isWaitingForNextQuestion(): boolean {
    return this.waitingForNextQuestion;
  }
}