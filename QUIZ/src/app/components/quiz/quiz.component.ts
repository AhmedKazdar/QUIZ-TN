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
  watchMode = false; // Track if in watch mode after wrong answer
  quizResult: Score | null = null;
  loading = false;
  error: string | null = null;
  mode: 'solo' | 'online' = 'solo';
  timeRemaining = 30; // 1 minute per question in online mode
  questionTimeLimit = 30; // 1 minute in seconds
  totalTime = 0;
  progress = 0;
  waitingForAnswer = false;
  answerWaitTime = 30; // 1 minute wait time in seconds
  answerWaitTimer: any = null;
  modeFromRoute = false;
  isAuthenticated = false;
  private quizSubscription: Subscription | null = null;
  private timerSubscription: Subscription | null = null;
  private quizStartTime: number = 0;
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
    if (this.answerWaitTimer) {
      clearInterval(this.answerWaitTimer);
    }
  }

  // Navigate to the appropriate home page based on authentication status
  navigateToHome(): void {
    if (this.isAuthenticated) {
      this.router.navigate(['/home']);
    } else {
      this.router.navigate(['/']);
    }
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
    this.timeRemaining = this.mode === 'online' ? this.questionTimeLimit : this.totalTime;
    this.quizStartTime = Date.now();
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
      this.router.navigate(['/login'], {
        queryParams: { returnUrl: '/quiz/online' }
      });
      return;
    }

    // Start the quiz with the current mode
    this.startQuiz(this.mode);
  }

  startQuiz(mode: 'solo' | 'online' = 'solo'): void {
    this.mode = mode;
    this.loading = true;
    this.error = null;

    // Reset quiz state
    this.quizStarted = true;
    this.quizFinished = false;
    this.quizResult = null;
    this.currentQuestionIndex = 0;
    this.selectedAnswer = null;
    this.answers = [];
    this.progress = 0;
    this.quizStartTime = Date.now();

    // For online mode, check quiz time first
    if (this.mode === 'online') {
      this.checkQuizTime();
    } else {
      // For solo mode, load questions directly
      this.loadQuestions();
    }
  }

  private checkQuizTime(): void {
    this.loading = true;
    this.error = null;

    // This is a placeholder - implement actual quiz time check with your service
    // Example:
    // this.quizService.checkQuizTime().subscribe({
    //   next: (result) => {
    //     if (result.canStart) {
    //       this.loadQuestions();
    //     } else {
    //       this.loading = false;
    //       this.quizStarted = false;
    //       this.error = result.message || 'The quiz is not available at this time.';
    //       if (result.nextQuizTime) {
    //         this.error += ` Next quiz time: ${result.nextQuizTime}`;
    //       }
    //     }
    //   },
    //   error: (error) => {
    //     console.error('Error checking quiz time:', error);
    //     this.loading = false;
    //     this.quizStarted = false;
    //     this.error = 'Failed to check quiz availability. Please try again later.';
    //   }
    // });

    // For now, just load questions
    this.loadQuestions();
  }

  private loadQuestions(): void {
    this.loading = true;
    
    // Load questions based on the current mode
    this.questionService.getQuestions(10).subscribe({
      next: (questions: Question[]) => {
        this.questions = questions;
        this.answers = new Array(questions.length).fill(null);
        
        if (this.mode === 'online') {
          // For online mode, we'll use 1 minute per question
          this.totalTime = questions.length * this.questionTimeLimit;
          this.timeRemaining = this.questionTimeLimit; // Start with 1 minute for the first question
        } else {
          // For solo mode, use total time calculation
          this.totalTime = questions.length * 30; // 30 seconds per question
          this.timeRemaining = this.totalTime;
        }
        
        this.startTimer(this.totalTime);
        this.loading = false;
      },
      error: (error: any) => {
        console.error('Error loading questions:', error);
        this.loading = false;
        this.error = 'Failed to load questions. Please try again.';
        this.quizStarted = false;
      }
    });
  }

  private handleError(error: any, context: 'load' | 'submit' = 'load'): void {
    console.error('Quiz error:', error);
    this.loading = false;
    
    let errorMessage = 'An error occurred. ';
    if (context === 'load') {
      errorMessage += 'Failed to load questions. ';
    } else {
      errorMessage += 'Failed to submit your answers. ';
    }
    errorMessage += 'Please try again later.';
    
    this.error = errorMessage;
    this.quizStarted = false;
    
    if (context === 'load') {
      this.error = 'Failed to load quiz. ' + 
        (error?.error?.message || 'Please try again later.');
    } else {
      // For submit/processing errors, we'll try to show local results
      this.error = 'Failed to process quiz results. Showing local results instead.';
      
      // Calculate and show local results as fallback
      const timeSpent = Math.max(1, Math.floor((Date.now() - this.quizStartTime) / 1000));
      this.calculateLocalScore(timeSpent).subscribe(score => {
        this.quizResult = score;
      });
    }
  }

  private finishQuiz(): void {
    this.quizFinished = true;
    this.stopTimer();
  }

  // Timer and progress methods
  private startTimer(duration: number): void {
    this.stopTimer();
    this.timeRemaining = duration;

    this.timerSubscription = interval(1000).subscribe({
      next: () => {
        if (this.timeRemaining > 0) {
          this.timeRemaining--;
          this.updateProgress();
        } else {
          this.stopTimer();
          this.mode === 'online' ? this.submitQuiz() : this.nextQuestion();
        }
      },
      error: (error) => console.error('Timer error:', error)
    });
  }



  private updateProgress(): void {
    if (!this.questions || this.questions.length === 0) {
      this.progress = 0;
      return;
    }
    
    if (this.mode === 'online') {
      this.progress = Math.round(((this.currentQuestionIndex + 1) / this.questions.length) * 100);
    } else {
      const timeElapsed = this.totalTime - this.timeRemaining;
      this.progress = this.totalTime > 0 
        ? Math.min(100, Math.round((timeElapsed / this.totalTime) * 100))
        : 0;
    }
  }

  // Navigation methods
  nextQuestion(): void {
    if (!this.questions || this.questions.length === 0) return;
    
    if (this.currentQuestionIndex < this.questions.length - 1) {
      this.currentQuestionIndex++;
      this.updateProgress();
      if (this.mode === 'online') {
        this.timeRemaining = this.questionTimeLimit; // Reset timer for the next question
      }
      this.selectedAnswer = null;
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
    if (index >= 0 && index < this.questions.length) {
      this.currentQuestionIndex = index;
      this.selectedAnswer = this.answers[this.currentQuestionIndex];
      this.updateProgress();
      this.scrollToTop();
    }
  }

  // Quiz submission methods
  submitQuiz(): void {
    if (this.quizFinished) return;
    
    this.loading = true;
    const timeSpent = Math.max(1, Math.floor((Date.now() - this.quizStartTime) / 1000));
    
    // Calculate score locally first
    this.calculateLocalScore(timeSpent).subscribe({
      next: (score: Score) => {
        this.quizResult = score;
        this.quizFinished = true;
        this.loading = false;
        this.stopTimer();
        this.scrollToTop();
        
        // If online mode and user is authenticated, save the score
        if (this.mode === 'online' && this.currentUserId) {
          this.saveScore(score, timeSpent);
        }
      },
      error: (error: any) => this.handleError(error, 'submit')
    });
  }

  private saveScore(score: Score, timeSpent: number): void {
    if (!this.currentUserId) return;
    
    this.scoreService.saveScore({
      userId: this.currentUserId,
      score: score.score,
      correctAnswers: score.correctAnswers,
      totalQuestions: score.totalQuestions,
      timeSpent: timeSpent
    }).subscribe({
      next: () => console.log('Score saved successfully'),
      error: (err: any) => console.error('Error saving score:', err)
    });
  }

 

  // UI helper methods
  private scrollToTop(): void {
    window.scrollTo({ top: 0, behavior: 'smooth' } as ScrollToOptions);
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

  // Answer selection
  selectAnswer(index: number): void {
    if (this.quizFinished || this.loading || this.waitingForAnswer) return;
    
    // Don't allow changing answer once selected in online mode
    if (this.mode === 'online' && this.answers[this.currentQuestionIndex] !== null) {
      return;
    }
    
    this.selectedAnswer = index;
    this.answers[this.currentQuestionIndex] = index;
    
    const isCorrect = index === this.questions[this.currentQuestionIndex]?.correctAnswer;
    const timeSpent = Math.floor((Date.now() - this.quizStartTime) / 1000);
    
    // For online mode, start the waiting period
    if (this.mode === 'online') {
      this.waitingForAnswer = true;
      this.startAnswerWaitTimer(() => {
        this.processAnswer(index, isCorrect, timeSpent);
      });
      return;
    }
    
    // For solo mode, process answer immediately
    this.processAnswer(index, isCorrect, timeSpent);
  }

  private processAnswer(index: number, isCorrect: boolean, timeSpent: number): void {
    if (!this.questions || this.questions.length === 0) return;
    
    // For online mode, check if answer is wrong first
    if (this.mode === 'online' && !isCorrect) {
      this.handleWrongAnswerInOnlineMode(index, timeSpent);
      return;
    }
    
    // For correct answers or solo mode
    if (this.currentQuestionIndex < this.questions.length - 1) {
      // Move to next question after a short delay
      setTimeout(() => {
        this.nextQuestion();
      }, 1000);
    } else {
      // Last question, submit the quiz
      this.submitQuiz();
    }
  }

  private handleWrongAnswerInOnlineMode(index: number, timeSpent: number): void {
    this.stopTimer();
    this.quizFinished = true;
    
    // Calculate final score
    const correctAnswers = this.questions.slice(0, this.currentQuestionIndex + 1).reduce((count, q, i) => {
      return count + (this.answers[i] === q.correctAnswer ? 1 : 0);
    }, 0);
    
    const totalQuestions = this.currentQuestionIndex + 1;
    const score = Math.round((correctAnswers / totalQuestions) * 100);
    
    this.quizResult = {
      _id: 'quiz-' + Date.now(),
      userId: this.currentUserId || 'anonymous',
      score: score,
      correctAnswers: correctAnswers,
      totalQuestions: totalQuestions,
      timeSpent: timeSpent,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    // Save the wrong answer if user is authenticated
    if (this.currentUserId && this.questions[this.currentQuestionIndex]?._id) {
      const response: SubmitResponseDto = {
        userId: this.currentUserId,
        questionId: this.questions[this.currentQuestionIndex]._id || '',
        answer: index,
        isCorrect: false,
        timeSpent: timeSpent
      };
      
      this.responseService.submitResponse(response).subscribe({
        next: () => console.log('Wrong answer response saved'),
        error: (err: any) => console.error('Error saving wrong answer:', err)
      });
    }
    
    this.scrollToTop();
  }

  private startAnswerWaitTimer(callback: () => void): void {
    // Clear any existing timer
    if (this.answerWaitTimer) {
      clearInterval(this.answerWaitTimer);
    }

    this.waitingForAnswer = true;
    this.answerWaitTime = 60; // Reset to 1 minute
    
    this.answerWaitTimer = setInterval(() => {
      this.answerWaitTime--;
      
      if (this.answerWaitTime <= 0) {
        clearInterval(this.answerWaitTimer);
        this.waitingForAnswer = false;
        this.answerWaitTime = 60; // Reset for next question
        callback();
      }
    }, 1000);
    
    this.scrollToTop();
  }


  private stopTimer(): void {
    if (this.timerSubscription) {
      this.timerSubscription.unsubscribe();
      this.timerSubscription = null;
    }
  }

        
  private calculateLocalScore(timeSpent: number): Observable<Score> {
    if (!this.questions || this.questions.length === 0) {
      return of({
        _id: 'local-' + Date.now(),
        userId: this.currentUserId || 'anonymous',
        score: 0,
        correctAnswers: 0,
        totalQuestions: 0,
        timeSpent: timeSpent,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      } as Score);
    }

    const correctAnswers = this.questions.reduce((count: number, q: Question, i: number) => {
      return count + (this.answers[i] === q.correctAnswer ? 1 : 0);
    }, 0);
    
    const score = this.questions.length > 0 
      ? Math.round((correctAnswers / this.questions.length) * 100)
      : 0;
    
    this.updateProgress();
    
    return of({
      _id: 'local-' + Date.now(),
      userId: this.currentUserId || 'anonymous',
      score: score,
      correctAnswers: correctAnswers,
      totalQuestions: this.questions.length,
      timeSpent: timeSpent,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    } as Score);
  }

 
  isQuizCompletedSuccessfully(): boolean {
    if (!this.quizResult) return false;
    const incorrect = (this.quizResult.totalQuestions || 0) - (this.quizResult.correctAnswers || 0);
    return incorrect === 0 || (incorrect === 1 && this.quizResult.correctAnswers === 0);
  }
}

