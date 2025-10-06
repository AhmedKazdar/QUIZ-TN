import { Injectable } from '@angular/core';
import { Observable, of, BehaviorSubject } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Question, QuestionService } from './api/question.service';

export interface QuizResult {
  _id?: string;
  userId: string;
  score: number;
  correctAnswers: number;
  totalQuestions: number;
  timeSpent: number;
  createdAt?: string;
  updatedAt?: string;
}

@Injectable({ providedIn: 'root' })
export class QuizService {
  private currentQuiz: Question[] = [];
  private currentAnswers: (number | -1)[] = [];
  private quizStartTime = 0;
  private quizMode: 'practice' | 'online' = 'practice';
  private quizResult$ = new BehaviorSubject<QuizResult | null>(null);

  constructor(private questionService: QuestionService) {}

  startQuiz(mode: 'practice' | 'online' = 'practice', limit = 10): Observable<Question[]> {
    this.quizMode = mode;
    this.quizStartTime = Date.now();
    this.currentAnswers = [];

    if (mode === 'practice') {
      return this.questionService.getQuestions(limit).pipe(
        tap(questions => {
          this.currentQuiz = questions;
          this.currentAnswers = new Array(questions.length).fill(-1);
        })
      );
    }

    return this.questionService.getRandomQuestions(limit).pipe(
      tap(questions => {
        this.currentQuiz = questions;
        this.currentAnswers = new Array(questions.length).fill(-1);
      })
    );
  }

  answerQuestion(index: number, selectedOption: number): void {
    if (index < 0 || index >= this.currentQuiz.length) return;
    this.currentAnswers[index] = selectedOption;
  }

  getAnswers(): (number | -1)[] {
    return [...this.currentAnswers];
  }

  getQuestion(index: number): Question | null {
    return this.currentQuiz[index] || null;
  }

  calculateScore(timeSpentSeconds: number): QuizResult {
    const total = this.currentQuiz.length || 0;
    const correct = this.currentQuiz.reduce((acc, q, i) => {
      const sel = this.currentAnswers[i];
      return acc + (sel !== null && sel !== -1 && q.options?.[sel]?.isCorrect ? 1 : 0);
    }, 0);

    const score = total ? Math.round((correct / total) * 100) : 0;

    const result: QuizResult = {
      userId: 'anonymous',
      score,
      correctAnswers: correct,
      totalQuestions: total,
      timeSpent: timeSpentSeconds
    };

    this.quizResult$.next(result);
    return result;
  }

  getQuizResult$(): Observable<QuizResult | null> {
    return this.quizResult$.asObservable();
  }

  reset(): void {
    this.currentQuiz = [];
    this.currentAnswers = [];
    this.quizStartTime = 0;
    this.quizMode = 'practice';
    this.quizResult$.next(null);
  }
}
