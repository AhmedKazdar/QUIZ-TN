import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { Subscription, of, forkJoin, Observable, interval } from 'rxjs';
import { delay, switchMap, catchError } from 'rxjs/operators';
import { AuthService } from '../../services/auth.service';
import { QuestionService, Question } from '../../services/api/question.service';
import { ResponseService, SubmitResponseDto } from '../../services/api/response.service';
import { ScoreService, Score } from '../../services/api/score.service';

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
  quizResult: Score | null = null;
  loading = false;
  error: string | null = null;
  mode: 'solo' | 'online' = 'solo';
  timeRemaining = 0;
  totalTime = 0;
  progress = 0;
  modeFromRoute = false;
  private quizSubscription: Subscription | null = null;
  private timerSubscription: Subscription | null = null;
  private quizStartTime: number = 0;
  isAuthenticated = false;
  private currentUserId: string | null = null;

  constructor(
    private authService: AuthService,
    private questionService: QuestionService,
    private responseService: ResponseService,
    private scoreService: ScoreService,
    private router: Router,
    private route: ActivatedRoute
  ) {
    this.isAuthenticated = this.authService.isAuthenticated();
    const currentUser = this.authService.currentUserValue;
    this.currentUserId = currentUser?._id || null;
  }

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      let mode = params['mode'] as 'solo' | 'online' | undefined;
      // Support static routes without :mode param, e.g., 'quiz/solo'
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
  }

  // Navigate to the appropriate home page based on authentication status
  navigateToHome(): void {
    if (this.isAuthenticated) {
      this.router.navigate(['/home']);
    } else {
      this.router.navigate(['/']);
    }
  }

  private cleanupSubscriptions(): void {
    if (this.quizSubscription) {
      this.quizSubscription.unsubscribe();
      this.quizSubscription = null;
    }
    this.stopTimer();
  }

  private initializeQuiz(): void {
    // Check if online mode requires authentication
    if (this.mode === 'online' && !this.authService.isAuthenticated()) {
      // Include returnUrl so after OTP the user comes back here
      this.router.navigate(['/register'], {
        queryParams: { returnUrl: '/quiz/online' }
      });
      return;
    }

    // Start the quiz immediately for solo mode
    this.loading = true;
    this.error = null;
    
    // Clear any existing subscriptions
    this.cleanupSubscriptions();

    // Fetch questions from the API
    this.quizSubscription = this.questionService.getQuestions(10)
      .pipe(
        catchError((error: any) => {
          console.error('Error fetching questions:', error);
          this.error = 'Failed to load questions. Please try again later.';
          this.loading = false;
          return of([]);
        })
      )
      .subscribe((questions: Question[]) => {
        if (questions && questions.length > 0) {
          this.questions = questions;
          this.answers = new Array(questions.length).fill(null);
          this.loading = false;
          this.quizStarted = true;
          this.quizStartTime = Date.now();
          this.startTimer(15 * 60); // 15 minutes timer
          this.updateProgress();
        } else {
          this.error = 'No questions available. Please try again later.';
          this.loading = false;
        }
      });
  }

  private handleQuizError(error: any, context: 'load' | 'submit' = 'load'): void {
    console.error(`Error ${context === 'load' ? 'loading' : 'processing'} quiz:`, error);
    
    if (context === 'load') {
      this.error = 'Failed to load quiz. ' + 
        (error?.error?.message || 'Please try again later.');
      this.loading = false;
    } else {
      // For submit/processing errors, we'll try to show local results
      this.error = 'Failed to process quiz results. Showing local results instead.';
      this.loading = false;
      
      // Calculate and show local results as fallback
      const timeSpent = Math.max(1, Math.floor((Date.now() - this.quizStartTime) / 1000));
      this.calculateLocalScore(timeSpent).subscribe(score => {
        this.quizResult = score;
        this.quizFinished = true;
        this.scrollToTop();
      });
    }
  }

  private startTimer(duration: number): void {
    this.totalTime = duration;
    this.timeRemaining = this.totalTime;
    this.quizStartTime = Date.now();
    
    // Clear any existing timer
    this.stopTimer();
    
    // Create a new interval
    this.timerSubscription = interval(1000).subscribe(() => {
      if (this.timeRemaining > 0) {
        this.timeRemaining--;
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
    // Ensure timeRemaining is not negative
    if (this.timeRemaining < 0) {
      this.timeRemaining = 0;
    }
  }

  private scrollToTop(): void {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  selectAnswer(index: number): void {
    if (this.quizFinished || this.loading) return;
    
    // Don't allow changing answer once selected
    if (this.answers[this.currentQuestionIndex] !== null && this.answers[this.currentQuestionIndex] !== undefined) {
      return;
    }
    
    this.selectedAnswer = index;
    this.answers[this.currentQuestionIndex] = index;
    
    // Auto-save the response if in online mode
    if (this.mode === 'online' && this.currentUserId) {
      const response: SubmitResponseDto = {
        userId: this.currentUserId,
        questionId: this.questions[this.currentQuestionIndex]._id,
        answer: index,
        isCorrect: index === this.questions[this.currentQuestionIndex].correctAnswer,
        timeSpent: Math.floor((Date.now() - this.quizStartTime) / 1000)
      };
      
      this.responseService.submitResponse(response).subscribe({
        next: () => console.log('Response saved'),
        error: (err) => console.error('Error saving response:', err)
      });
    }
    
    // Auto move to next question after a short delay to show feedback
    setTimeout(() => {
      if (this.currentQuestionIndex < this.questions.length - 1) {
        this.nextQuestion();
      } else if (this.mode === 'solo') {
        this.finishQuiz();
      }
    }, 1000);
  }

  nextQuestion(): void {
    if (this.selectedAnswer === null) return;

    // Save the answer
    this.answers[this.currentQuestionIndex] = this.selectedAnswer;
    this.selectedAnswer = null;

    // Move to next question or finish quiz
    if (this.currentQuestionIndex < this.questions.length - 1) {
      this.currentQuestionIndex++;
      this.updateProgress();
    } else {
      this.submitQuiz();
    }
  }

  skipQuestion(): void {
    this.answers[this.currentQuestionIndex] = null;
    if (this.currentQuestionIndex < this.questions.length - 1) {
      this.currentQuestionIndex++;
      this.updateProgress();
    } else {
      this.submitQuiz();
    }
  }

  submitQuiz(): void {
    // Prevent multiple submissions
    if (this.loading || this.quizFinished) return;
    
    this.loading = true;
    const timeSpent = Math.max(1, Math.floor((Date.now() - this.quizStartTime) / 1000));
    
    // If we have a user ID, try to submit to the backend
    if (this.currentUserId) {
      // Prepare responses for submission
      const responses: SubmitResponseDto[] = this.questions.map((question, index) => ({
        userId: this.currentUserId!,
        questionId: question._id,
        answer: this.answers[index] ?? -1,
        isCorrect: this.answers[index] === question.correctAnswer,
        timeSpent: timeSpent / this.questions.length // Average time per question
      }));
      
      // Submit responses to the backend
      this.responseService.submitResponses(responses).pipe(
        switchMap(() => this.scoreService.calculateScore(this.currentUserId!)),
        catchError(error => {
          console.error('Error submitting responses:', error);
          return this.calculateLocalScore(timeSpent);
        })
      ).subscribe({
        next: (score) => this.handleQuizCompletion(score, timeSpent),
        error: (error) => this.handleQuizError(error, 'submit')
      });
    } else {
      // For anonymous users, just calculate the score locally
      this.calculateLocalScore(timeSpent).subscribe({
        next: (score) => this.handleQuizCompletion(score, timeSpent),
        error: (error) => this.handleQuizError(error, 'submit')
      });
    }
  }
  
  private handleQuizCompletion(score: Score, timeSpent: number): void {
    // Update the quiz result with the final score
    this.quizResult = {
      ...score,
      timeSpent: timeSpent  // Ensure we use the actual time spent
    };
    this.quizFinished = true;
    this.loading = false;
    this.stopTimer();
    this.scrollToTop();
  }

  private calculateLocalScore(timeSpent: number): Observable<Score> {
    if (!this.questions.length || !this.answers.length) {
      return of({
        _id: 'local-' + Date.now(),
        userId: this.currentUserId || 'anonymous',
        score: 0,
        correctAnswers: 0,
        totalQuestions: 0,
        timeSpent,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }
    
    const correctAnswers = this.questions.reduce((count, question, index) => {
      return count + (this.answers[index] === question.correctAnswer ? 1 : 0);
    }, 0);
    
    const totalQuestions = this.questions.length;
    const score = Math.round((correctAnswers / totalQuestions) * 100);
    
    return of({
      _id: 'local-' + Date.now(),
      userId: this.currentUserId || 'anonymous',
      score,
      correctAnswers,
      totalQuestions,
      timeSpent,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  }

  private finishQuiz(): void {
    // If we're already submitting or finished, do nothing
    if (this.loading || this.quizFinished) return;
    
    // If we have a current user, submit the quiz to save results
    if (this.currentUserId) {
      this.submitQuiz();
    } else {
      // For anonymous users, just calculate and show local results
      this.stopTimer();
      this.quizFinished = true;
      
      const correct = this.calculateScore();
      const percentage = Math.round((correct / this.questions.length) * 100);
      const timeSpent = this.totalTime - this.timeRemaining;
      
      // Create a proper Score object
      this.quizResult = {
        _id: 'local-' + Date.now(),
        userId: 'anonymous',
        score: percentage,
        correctAnswers: correct,
        totalQuestions: this.questions.length,
        timeSpent: timeSpent,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
    }
  }

  private calculateScore(): number {
    return this.questions.reduce((score: number, question: Question, index: number) => {
      const answer = this.answers[index];
      return score + (answer !== null && answer === question.correctAnswer ? 1 : 0);
    }, 0);
  }

  startQuiz(mode: 'solo' | 'online' = 'solo'): void {
    this.mode = mode;
    this.quizStarted = true;
    this.quizFinished = false;
    this.quizResult = null;
    this.currentQuestionIndex = 0;
    this.answers = [];
    this.selectedAnswer = null;
    this.progress = 0;
    this.error = null;
    this.initializeQuiz();
  }

  restartQuiz(): void {
    this.cleanupSubscriptions();
    this.quizStarted = false;
    this.quizFinished = false;
    this.quizResult = null;
    this.currentQuestionIndex = 0;
    this.answers = [];
    this.selectedAnswer = null;
    this.progress = 0;
    // Start a fresh quiz in the current mode (solo/online)
    this.startQuiz(this.mode);
  }

  goHome(): void {
    this.router.navigate(['/home']);
  }

  private updateProgress(): void {
    this.progress = Math.round(((this.currentQuestionIndex + 1) / this.questions.length) * 100);
    this.scrollToTop();
  }

  previousQuestion(): void {
    if (this.currentQuestionIndex > 0) {
      this.currentQuestionIndex--;
      this.selectedAnswer = this.answers[this.currentQuestionIndex];
      this.scrollToTop();
      this.updateProgress();
    }
  }

  navigateToQuestion(index: number): void {
    if (index >= 0 && index < this.questions.length) {
      this.currentQuestionIndex = index;
      this.selectedAnswer = this.answers[this.currentQuestionIndex];
      this.scrollToTop();
      this.updateProgress();
    }
  }

  get scorePercentage(): number {
    return this.quizResult?.score ?? 0;
  }

  getScoreClass(score: number): string {
    if (score >= 80) return 'excellent';
    if (score >= 60) return 'good';
    if (score >= 40) return 'average';
    return 'poor';
  }
}
