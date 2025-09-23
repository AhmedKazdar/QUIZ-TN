import { Component, OnInit, OnDestroy } from '@angular/core';
import { QuizService, QuizResult, Question } from '../../services/quiz.service';
import { Router, ActivatedRoute } from '@angular/router';
import { Subscription, Observable, of } from 'rxjs';
import { delay } from 'rxjs/operators';

@Component({
  selector: 'app-quiz',
  templateUrl: './quiz.component.html',
  styleUrls: ['./quiz.component.scss']
})
export class QuizComponent implements OnInit, OnDestroy {
  questions: Question[] = [];
  currentQuestionIndex = 0;
  answers: (number | null)[] = [];
  selectedAnswer: number | null = null;
  quizStarted = false;
  quizFinished = false;
  quizResult: QuizResult | null = null;
  loading = false;
  error: string | null = null;
  mode: 'practice' | 'online' = 'practice';
  timeRemaining = 0;
  totalTime = 0;
  progress = 0;
  private quizSubscription: Subscription | null = null;
  private timerSubscription: Subscription | null = null;

  constructor(
    public quizService: QuizService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      const mode = params['mode'];
      if (mode === 'practice' || mode === 'online') {
        this.mode = mode;
        this.loadQuiz();
      } else {
        this.router.navigate(['/home']);
      }
    });
  }

  ngOnDestroy(): void {
    if (this.quizSubscription) {
      this.quizSubscription.unsubscribe();
    }
    this.stopTimer();
  }

  startQuiz(mode: 'practice' | 'online'): void {
    if (this.loading) return;
    this.mode = mode;
    this.loadQuiz();
  }

  loadQuiz(): void {
    this.loading = true;
    this.error = null;
    
    this.quizSubscription = this.quizService.fetchQuestions(undefined, undefined, 10).subscribe({
      next: (questions) => {
        if (questions && questions.length > 0) {
          this.questions = questions;
          this.answers = new Array(questions.length).fill(null);
          this.loading = false;
          this.quizStarted = true;
          this.startTimer();
        } else {
          this.error = 'No questions available. Please try again later.';
          this.loading = false;
        }
      },
      error: (err) => {
        console.error('Error loading quiz:', err);
        this.error = 'Failed to load quiz. Please make sure the backend server is running.';
        this.loading = false;
      }
    });
  }

  private startTimer(): void {
    this.totalTime = this.questions.length * 15;
    this.timeRemaining = this.totalTime;
    this.updateTimer();
  }

  private updateTimer(): void {
    this.timerSubscription = of(null).pipe(
      delay(1000)
    ).subscribe(() => {
      if (this.timeRemaining > 0) {
        this.timeRemaining--;
        this.updateTimer();
      } else if (!this.quizFinished) {
        this.finishQuiz();
      }
    });
  }

  private stopTimer(): void {
    if (this.timerSubscription) {
      this.timerSubscription.unsubscribe();
      this.timerSubscription = null;
    }
  }

  selectAnswer(index: number): void {
    this.selectedAnswer = index;
  }

  onAnswerChange(event: any): void {
    if (event.target) {
      this.selectedAnswer = parseInt(event.target.value, 10);
      this.quizService.submitAnswer(this.currentQuestionIndex, this.selectedAnswer);
    }
  }

  navigateToQuestion(index: number): void {
    if (index >= 0 && index < this.questions.length) {
      this.currentQuestionIndex = index;
      this.selectedAnswer = this.answers[this.currentQuestionIndex];
      this.scrollToTop();
    }
  }

  nextQuestion(): void {
    if (this.selectedAnswer !== null) {
      this.answers[this.currentQuestionIndex] = this.selectedAnswer;
      
      // Submit the response to the backend
      const currentQuestion = this.questions[this.currentQuestionIndex];
      this.quizService.submitResponse(
        'current-user-id', // Replace with actual user ID from auth service
        currentQuestion._id,
        this.selectedAnswer
      ).subscribe({
        next: (response) => {
          console.log('Response submitted successfully:', response);
        },
        error: (err) => {
          console.error('Error submitting response:', err);
        }
      });
      
      this.selectedAnswer = null;
      
      if (this.currentQuestionIndex < this.questions.length - 1) {
        this.currentQuestionIndex++;
        this.updateProgress();
      } else {
        this.finishQuiz();
      }
    }
  }

  previousQuestion(): void {
    if (this.currentQuestionIndex > 0) {
      this.currentQuestionIndex--;
      this.selectedAnswer = this.answers[this.currentQuestionIndex];
      this.scrollToTop();
    }
  }

  submitQuiz(): void {
    if (confirm('Are you sure you want to submit your answers?')) {
      this.finishQuiz();
    }
  }

  private finishQuiz(): void {
    this.quizFinished = true;
    this.stopTimer();
    this.calculateResult();
  }

  private calculateResult(): void {
    if (!this.questions.length) return;
  
    const correctAnswers = this.answers.reduce((count: number, answer, index) => {
      // Skip if answer is null or question doesn't exist
      if (answer === null || !this.questions[index]) return count;
      return count + (answer === this.questions[index].correctAnswer ? 1 : 0);
    }, 0);
  
    const totalQuestions = this.questions.length;
    const score = Math.round((correctAnswers / totalQuestions) * 100);
  
    this.quizResult = {
      score: score,
      total: totalQuestions,
      correctAnswers: correctAnswers,
      incorrectAnswers: totalQuestions - correctAnswers,
      timeSpent: this.totalTime - this.timeRemaining
    };
  }

  get scorePercentage(): number {
    return this.quizResult ? this.quizResult.score : 0;
  }

  getScoreClass(score: number): string {
    if (score >= 80) return 'excellent';
    if (score >= 60) return 'good';
    if (score >= 40) return 'average';
    return 'poor';
  }

  restartQuiz(): void {
    this.quizStarted = false;
    this.quizFinished = false;
    this.quizResult = null;
    this.currentQuestionIndex = 0;
    this.answers = [];
    this.selectedAnswer = null;
    this.loading = false;
    this.error = null;
    this.timeRemaining = 0;
    this.progress = 0;
  }

  goHome(): void {
    this.router.navigate(['/home']);
  }

  private scrollToTop(): void {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  private updateProgress(): void {
    this.progress = Math.round(((this.currentQuestionIndex + 1) / this.questions.length) * 100);
    this.scrollToTop();
  }
}