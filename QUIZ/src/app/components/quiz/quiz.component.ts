// quiz.component.ts - COMPLETE UPDATED VERSION
import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription, Observable, interval } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { ScoreService } from '../../services/api/score.service';
import { SocketService, OnlineUser } from '../../services/socket.service';
import { QuizService, Question, QuizResult, GameWinner, SoloAnswerValidationRequest, AnswerOption } from 'src/app/services/quiz.service';

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
  quizResult: QuizResult | null = null;

  loading = false;
  error: string | null = null;
  mode: 'solo' | 'online' = 'solo';
  modeFromRoute = false;

  /*** Timers & Progress ***/
  questionTimeLimit = 15;
  totalTime = 0;
  timeRemaining = 15;
  progress = 0;

  /*** User ***/
  isAuthenticated = false;
  currentUserId: string | null = null;

  /*** Winner & Game Over State ***/
  gameWinner: GameWinner | null = null;
  gameOver = false;
  isWinner = false;

  /*** Answer Feedback ***/
  showAnswerFeedback = false;
  currentCorrectAnswerIndex: number | null = null;
  isAnswerCorrect: boolean | null = null;

  /*** Answer Submission State ***/
  answerSubmitted = false;
  correctAnswersCount = 0;

  /*** Internals ***/
  private quizSubscription: Subscription | null = null;
  private timerSubscription: Subscription | null = null;
  private quizStartTime = 0;
  private questionStartTime = 0;
  private quizId = 'online-quiz-' + Date.now();
  private socketSubscriptions = new Subscription();
  private routeSubscription: Subscription | null = null;
  onlineUsers: OnlineUser[] = [];
  isSocketConnected = false;

  /*** Sequential Quiz State ***/
  sequentialQuizState: any = null;
  players: OnlineUser[] = [];

  constructor(
    private authService: AuthService,
    private quizService: QuizService,
    private scoreService: ScoreService,
    private router: Router,
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef,
    private socketService: SocketService
  ) {}

  async ngOnInit(): Promise<void> {
    this.debugUserStatus();
    
    this.routeSubscription = this.route.params.subscribe(async (params) => {
      let mode = params['mode'] as 'solo' | 'online' | undefined;

      if (!mode) {
        const path = this.route.snapshot.routeConfig?.path || '';
        if (path.includes('quiz/solo')) mode = 'solo';
        else if (path.includes('quiz/online')) mode = 'online';
      }

      if (mode === 'solo' || mode === 'online') {
        this.mode = mode;
        this.modeFromRoute = true;
        
        console.log(`Initializing ${mode} quiz...`);
        
        // Wait for WebSocket connection
        try {
          const connected = await this.socketService.getConnection();
          if (connected) {
            console.log(' QuizComponent: WebSocket connected, initializing quiz');
            this.initializeQuiz();
          } else {
            this.handleQuizError('WebSocket connection failed. Please refresh the page.');
          }
        } catch (error) {
          console.error(' QuizComponent: Failed to get WebSocket connection:', error);
          this.handleQuizError('Connection error. Please try again.');
        }
      } else {
        this.router.navigate(['/home']);
      }
    });
  }

  private debugUserStatus(): void {
    const currentUser = this.authService.currentUserValue;
    const token = this.authService.getToken();
    
    console.log(' [Quiz] User Status Debug:', {
      isAuthenticated: this.authService.isAuthenticated(),
      hasCurrentUser: !!currentUser,
      userId: currentUser?._id,
      username: currentUser?.username,
      hasToken: !!token,
      tokenLength: token?.length,
      mode: this.mode,
      isGuest: currentUser?._id?.startsWith?.('guest-')
    });
  }

  ngOnDestroy(): void {
    console.log('[QuizComponent] Component destroyed - cleaning up subscriptions');
    this.cleanupSubscriptions();
    this.routeSubscription?.unsubscribe();
    
    // Add specific cleanup for online mode
    if (this.mode === 'online' && this.quizId) {
      console.log('[QuizComponent] Leaving online quiz session:', this.quizId);
      this.quizService.leaveQuizSession(this.quizId).subscribe({
        next: () => console.log('[QuizComponent] Successfully left quiz session'),
        error: (err) => console.error('[QuizComponent] Error leaving quiz session:', err)
      });
    }
  }

  navigateToHome(): void {
    console.log('[QuizComponent] User navigating home - cleaning up quiz session');
    
    // Clean up BEFORE navigating
    this.cleanupSubscriptions();
    this.stopTimer();
    
    if (this.mode === 'online' && this.quizId) {
      console.log('[QuizComponent] Leaving online quiz session before navigation:', this.quizId);
      this.quizService.leaveQuizSession(this.quizId).subscribe({
        next: () => {
          console.log('[QuizComponent] Successfully left quiz session, navigating home');
          this.performNavigation();
        },
        error: (err) => {
          console.error('[QuizComponent] Error leaving quiz session, still navigating:', err);
          this.performNavigation();
        }
      });
    } else {
      this.performNavigation();
    }
  }

  private performNavigation(): void {
    this.router.navigate([this.isAuthenticated ? '/home' : '/']);
  }

  restartQuiz(): void {
    console.log(' Restarting quiz in mode:', this.mode);

    // Clean up existing state first
    this.cleanupSubscriptions();
    this.stopTimer();
    
    if (this.mode === 'online' && this.quizId) {
      console.log('[QuizComponent] Leaving existing quiz session before restart:', this.quizId);
      this.quizService.leaveQuizSession(this.quizId).subscribe({
        next: () => console.log('[QuizComponent] Successfully left quiz session for restart'),
        error: (err) => console.error('[QuizComponent] Error leaving quiz session for restart:', err)
      });
    }
    
    // Reset all state
    this.correctAnswersCount = 0;
    this.cleanupSoloMode();
    
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
    this.isAnswerCorrect = null;
    this.answerSubmitted = false;
    this.loading = true;

    this.sequentialQuizState = null;
    this.players = [];

    // Generate new quiz ID
    this.quizId = `${this.mode}-quiz-${Date.now()}`;

    if (this.mode === 'solo') {
      setTimeout(() => {
        this.startSoloQuizFlow();
      }, 300);
    } else {
      this.startQuiz('online');
    }
  }

  private cleanupSoloMode(): void {
    this.stopTimer();
    this.questions = [];
    this.answers = [];
    this.currentQuestionIndex = 0;
    this.selectedAnswer = null;
  }

  private initializeQuiz(): void {
    console.log(` initializeQuiz called for ${this.mode} mode`);
    
    // Set user info
    this.isAuthenticated = this.authService.isAuthenticated();
    this.currentUserId = this.authService.currentUserValue?._id || null;
    
    console.log(' User state:', {
      isAuthenticated: this.isAuthenticated,
      userId: this.currentUserId,
      username: this.authService.currentUserValue?.username,
      mode: this.mode
    });

    // Clean up any existing subscriptions first
    this.cleanupSubscriptions();
    
    console.log(' Setting up socket listeners');
    this.setupSocketListeners();
    
    // Redirect unauthenticated users trying to play online
    if (this.mode === 'online' && !this.isAuthenticated) {
      console.log(' Redirecting to login for online mode');
      this.router.navigate(['/login'], { 
        queryParams: { returnUrl: '/quiz/online' } 
      });
      return;
    }
    
    // Start the quiz
    this.startQuiz(this.mode);
  }

private setupSocketListeners(): void {
  console.log('[QuizComponent] Setting up socket listeners only');

  try {
    this.socketSubscriptions.unsubscribe();
  } catch (e) {}
  this.socketSubscriptions = new Subscription();

    // SOLO MODE LISTENERS
    const soloQuestionsLoadedSub = this.quizService.onSoloQuestionsLoaded().subscribe((data: any) => {
      console.log(' Solo questions loaded via WebSocket:', data);
      if (this.mode === 'solo' && data?.questions) {
        this.questions = data.questions;
        this.answers = new Array(data.questions.length).fill(null);
        this.totalTime = 0;
        this.timeRemaining = 0;
        this.loading = false;
        this.quizStarted = true;
        console.log(` Solo quiz started with ${data.questions.length} questions (no timer)`);
        this.cdr.detectChanges();
      }
    });

    const soloQuestionsErrorSub = this.quizService.onSoloQuestionsError().subscribe((error: any) => {
      console.error(' Solo questions error:', error);
      if (this.mode === 'solo') {
        this.handleQuizError(error?.message || 'Failed to load solo questions');
      }
    });

    // Solo answer validation listener
    const soloAnswerValidationSub = this.quizService.onSoloAnswerValidation().subscribe((data: any) => {
      console.log(' Solo answer validation result:', data);
      if (this.mode === 'solo' && data.validated) {
        this.handleSoloAnswerValidation(data);
      }
    });

    // ONLINE MODE LISTENERS
    const sequentialQuizStartedSub = this.quizService.onSequentialQuizStarted().subscribe((data: any) => {
      if (this.mode === 'online') {
        console.log(' Sequential quiz started:', data);
        this.sequentialQuizState = {
          quizId: data.quizId,
          currentQuestion: null,
          questionIndex: -1,
          totalQuestions: data.totalQuestions,
          players: data.players || [],
        };
        this.players = data.players || [];
        this.cdr.detectChanges();
      }
    });

    const timeExpiredSub = this.socketService.onTimeExpired().subscribe((data: any) => {
      console.log(' Time expired event received:', data);
      
      if (data.quizId === this.quizId) {
        if (this.watchMode) {
          this.showCorrectAnswerToEliminatedPlayer();
        }
        
        this.showAnswerFeedback = true;
        this.loading = false;
        this.cdr.detectChanges();
      }
    });

    const sequentialQuizJoinedSub = this.quizService.onSequentialQuizJoined().subscribe((data: any) => {
      if (this.mode === 'online') {
        console.log(' Sequential quiz joined:', data);
        this.sequentialQuizState = {
          quizId: data.quizId,
          currentQuestion: null,
          questionIndex: data.currentQuestionIndex,
          totalQuestions: data.totalQuestions,
          players: data.players,
        };
        this.players = data.players;
        this.cdr.detectChanges();
      }
    });

    const nextQuestionSub = this.quizService.onNextQuestion().subscribe((data: any) => {
      if (this.mode === 'online') {
        console.log(' Next question received:', data);
        this.handleNextQuestion(data);
      }
    });

    const sequentialAnswerResultSub = this.quizService.onSequentialAnswerResult().subscribe((data: any) => {
      if (this.mode === 'online') {
        console.log('Sequential answer result:', data);
        this.handleSequentialAnswerResult(data);
      }
    });

    const playerJoinedSequentialSub = this.quizService.onPlayerJoinedSequential().subscribe((data: any) => {
      if (this.mode === 'online' && this.sequentialQuizState) {
        console.log('Player joined sequential:', data);
        this.sequentialQuizState.players = data.players;
        this.players = data.players;
        this.cdr.detectChanges();
      }
    });

    const playerAnsweredSequentialSub = this.quizService.onPlayerAnsweredSequential().subscribe((data: any) => {
      if (this.mode === 'online') {
        console.log(' Player answered in quiz:', data);
      }
    });

    const sequentialQuizFinishedSub = this.quizService.onSequentialQuizFinished().subscribe((data: any) => {
      if (this.mode === 'online') {
        console.log(' Sequential quiz finished:', data);
        this.handleSequentialQuizFinished();
      }
    });

    

 const fastestWinnerSub = this.quizService.onFastestWinnerDeclared().subscribe((data: any) => {
  if (this.mode === 'online') {
    this.debugWinnerAnnouncement(data);
    
    if (data.winner && data.quizId === this.quizId) {
      console.log('[QuizComponent] Fastest winner detected - immediately ending game');
      
      // CRITICAL: Stop all timers first
      this.stopTimer();
      
      // Set game state
      this.gameOver = true;
      this.gameWinner = data.winner;
      this.isWinner = data.winner.userId === this.currentUserId;
      this.quizFinished = true;
      this.quizStarted = false;
      this.loading = false;
      this.showAnswerFeedback = false;
      
      console.log(` [QuizComponent] Game over! Winner: ${data.winner.username}, Is me: ${this.isWinner}`);
      
      // Force UI update
      setTimeout(() => {
        this.cdr.detectChanges();
        console.log(' [QuizComponent] UI updated with winner information');
      }, 0);
    }
  }
});

  const gameOverSub = this.quizService.onGameOver().subscribe((data: any) => {
    if (this.mode === 'online') {
      console.log(' Game over event received:', data);
      this.handleGameOver(data?.winner);
    }
  });

  

    // Connection handler - ONLY LISTEN, DON'T MANAGE
    const connectionSub = this.quizService.getSocketConnectionStatus().subscribe((connected: boolean) => {
      console.log(` [QuizComponent] Connection status: ${connected ? 'Connected' : 'Disconnected'}`);
      
      if (connected && this.sequentialQuizState && !this.quizFinished) {
        console.log(' Socket reconnected - rejoining sequential quiz');
        setTimeout(() => {
          if (this.sequentialQuizState?.quizId) {
            this.quizService.joinSequentialQuiz(this.sequentialQuizState.quizId);
          }
        }, 1000);
      }
    });

    // Online users listeners
    const usersSub = this.quizService.getOnlineUsers().subscribe((users) => {
      this.onlineUsers = users || [];
      console.log(' Online users updated:', this.onlineUsers.length);
      this.cdr.detectChanges();
    });

    const statusSub = this.quizService.getSocketConnectionStatus().subscribe((connected) => {
      this.isSocketConnected = connected;
      console.log(` [QuizComponent] Socket connection status: ${connected ? 'Connected' : 'Disconnected'}`);
    });

    // Add all subscriptions
    this.socketSubscriptions.add(soloQuestionsLoadedSub);
    this.socketSubscriptions.add(soloQuestionsErrorSub);
    this.socketSubscriptions.add(soloAnswerValidationSub);
    this.socketSubscriptions.add(sequentialQuizStartedSub);
    this.socketSubscriptions.add(timeExpiredSub);
    this.socketSubscriptions.add(sequentialQuizJoinedSub);
    this.socketSubscriptions.add(nextQuestionSub);
    this.socketSubscriptions.add(sequentialAnswerResultSub);
    this.socketSubscriptions.add(playerJoinedSequentialSub);
    this.socketSubscriptions.add(playerAnsweredSequentialSub);
    this.socketSubscriptions.add(sequentialQuizFinishedSub);
    this.socketSubscriptions.add(fastestWinnerSub);
    this.socketSubscriptions.add(gameOverSub);
    this.socketSubscriptions.add(connectionSub);
    this.socketSubscriptions.add(usersSub);
    this.socketSubscriptions.add(statusSub);
  }


  private debugWinnerAnnouncement(data: any): void {
  console.log(' [QuizComponent] Winner Announcement Debug:', {
    mode: this.mode,
    currentQuizId: this.quizId,
    receivedQuizId: data.quizId,
    hasWinner: !!data.winner,
    winnerUsername: data.winner?.username,
    winnerUserId: data.winner?.userId,
    currentUserId: this.currentUserId,
    isWinner: data.winner?.userId === this.currentUserId,
    gameOver: this.gameOver,
    quizFinished: this.quizFinished
  });
}
  private findSoloCorrectAnswerIndex(correctAnswerText: string): number | null {
    const currentQuestion = this.questions[this.currentQuestionIndex];
    if (!currentQuestion?.options) {
      console.warn(' [Solo] No options available for current question');
      return null;
    }

    console.log(' [Solo] Finding correct answer:', {
      correctAnswerText,
      availableOptions: currentQuestion.options.map(opt => opt.text)
    });

    // Normalize for comparison
    const normalizedCorrect = correctAnswerText.trim().toLowerCase();
    
    for (let i = 0; i < currentQuestion.options.length; i++) {
      const optionText = currentQuestion.options[i].text.trim().toLowerCase();
      
      // Exact match
      if (optionText === normalizedCorrect) {
        console.log(` [Solo] Exact match found at index ${i}`);
        return i;
      }
      
      // Handle ellipsis and partial matches
      const cleanOption = optionText.replace('...', '').trim();
      const cleanCorrect = normalizedCorrect.replace('...', '').trim();
      
      if (cleanOption === cleanCorrect) {
        console.log(` [Solo] Clean match found at index ${i}`);
        return i;
      }
      
      // Contains match
      if (optionText.includes(normalizedCorrect) || normalizedCorrect.includes(optionText)) {
        console.log(` [Solo] Contains match found at index ${i}`);
        return i;
      }
    }

    console.warn(' [Solo] No matching answer found in options');
    return null;
  }

  private handleSoloAnswerValidation(data: any): void {
    console.log(' [Solo] Answer validation received:', data);
    const { questionIndex, isCorrect, correctAnswer } = data;
    
    if (questionIndex === this.currentQuestionIndex) {
      // Update correct answers count
      if (isCorrect) {
        this.correctAnswersCount++;
      }
      
      // Use the correct answer text from backend to find the index
      this.currentCorrectAnswerIndex = this.findSoloCorrectAnswerIndex(correctAnswer);
      
      console.log(` [Solo] Validation: ${isCorrect ? 'CORRECT' : 'INCORRECT'}, Correct index: ${this.currentCorrectAnswerIndex}, Total correct: ${this.correctAnswersCount}`);
      
      // Show feedback
      this.isAnswerCorrect = isCorrect;
      this.showAnswerFeedback = true;
      this.loading = false;

      // Auto-proceed after 2 seconds
      setTimeout(() => {
        this.showAnswerFeedback = false;
        this.currentCorrectAnswerIndex = null;
        this.isAnswerCorrect = null;
        this.answerSubmitted = false;
        
        if (this.currentQuestionIndex < this.questions.length - 1) {
          this.nextQuestion();
        } else {
          this.submitQuiz();
        }
      }, 2000);
      
      this.cdr.detectChanges();
    }
  }

  private showCorrectAnswerToEliminatedPlayer(): void {
    if (!this.questions[this.currentQuestionIndex]) return;

    console.log(' Showing correct answer for question', this.currentQuestionIndex);
    
    const currentQuestion = this.questions[this.currentQuestionIndex];
    
    // Try multiple ways to find the correct answer
    if (currentQuestion && currentQuestion.options) {
      // Method 1: Look for option with isCorrect = true
      const correctOption = currentQuestion.options.find((opt: any) => opt.isCorrect === true);
      if (correctOption) {
        this.currentCorrectAnswerIndex = currentQuestion.options.indexOf(correctOption);
        console.log(`Found correct answer at index ${this.currentCorrectAnswerIndex}:`, correctOption.text);
      } else {
        console.log(' No option with isCorrect=true found');
        
        // Method 2: Check if sequential quiz state has the answer
        if (this.sequentialQuizState?.currentQuestion?.options) {
          const seqCorrectOption = this.sequentialQuizState.currentQuestion.options.find((opt: any) => opt.isCorrect === true);
          if (seqCorrectOption) {
            this.currentCorrectAnswerIndex = this.sequentialQuizState.currentQuestion.options.indexOf(seqCorrectOption);
            console.log(` Found correct answer in sequential state at index ${this.currentCorrectAnswerIndex}`);
          }
        }
        
        // Method 3: If still not found, use the first option as fallback (for testing)
        if (this.currentCorrectAnswerIndex === null && currentQuestion.options.length > 0) {
          this.currentCorrectAnswerIndex = 0; // Fallback to first option
          console.log(' Using fallback - first option as correct answer');
        }
      }
    }
    
    this.showAnswerFeedback = true;
    this.cdr.detectChanges();
  }

  private proceedToNextQuestion(): void {
    console.log('Watch mode - proceeding to next question');
    
    if (this.currentQuestionIndex < this.totalQuestionsCount - 1) {
      // Request next question from server
      this.quizService.requestNextQuestion(this.quizId);
      this.loading = true;
    } else {
      console.log(' Final question completed in watch mode');
      this.loading = true;
      // Wait for winner announcement from server
    }
  }

  private handleNextQuestion(data: any): void {
    if (this.mode !== 'online') return;

    const { question, questionIndex, totalQuestions, startTime } = data || {};

    console.log(` Processing sequential question ${questionIndex + 1} of ${totalQuestions}`);
    console.log(` Watch mode status: ${this.watchMode ? 'ACTIVE' : 'INACTIVE'}`);

    if (!question || typeof questionIndex !== 'number') {
      console.warn('handleNextQuestion: invalid payload', data);
      return;
    }

    if (this.sequentialQuizState) {
      this.sequentialQuizState.currentQuestion = question;
      this.sequentialQuizState.questionIndex = questionIndex;
      this.sequentialQuizState.totalQuestions = totalQuestions;
    }

    if (!this.questions) this.questions = [];
    if (!this.answers) this.answers = [];

    this.questions[questionIndex] = question;
    this.answers[questionIndex] = null;
    this.currentQuestionIndex = questionIndex;
    this.loading = false;
    this.selectedAnswer = null;
    this.showAnswerFeedback = false;
    this.currentCorrectAnswerIndex = null;
    this.answerSubmitted = false;
    
    // IMPORTANT: Keep watch mode if player was already eliminated
    // Don't reset watchMode here - it should persist until quiz ends
    
    console.log(`Loaded sequential question ${questionIndex + 1}`);

    this.timeRemaining = this.questionTimeLimit;
    this.questionStartTime = startTime || Date.now();
    this.startTimer(this.questionTimeLimit);

    this.updateProgress();
    this.cdr.detectChanges();
  }

  private handleSequentialAnswerResult(data: any): void {
    console.log(' [QuizComponent] Received answer result from server:', data);

    const { questionIndex, isCorrect, correctAnswer, timeSpent, isFinalQuestion } = data || {};

    if (questionIndex === this.currentQuestionIndex) {
      console.log(`[QuizComponent] Processing answer result for current question`);
      
      this.currentCorrectAnswerIndex = this.findCorrectAnswerIndex(correctAnswer);
      
      console.log(`[QuizComponent] Server validation:`, {
        isCorrect: isCorrect,
        correctAnswerText: correctAnswer,
        foundAtIndex: this.currentCorrectAnswerIndex
      });

      if (isCorrect === false && !this.watchMode) {
        console.log(' [QuizComponent] Wrong answer - will eliminate when time expires');
        
        // Mark that the player answered incorrectly but DON'T eliminate immediately
        // Just store the result and wait for timer to expire
        this.answers[this.currentQuestionIndex] = this.selectedAnswer;
        this.isAnswerCorrect = false;
        
        // The actual elimination will happen when handleTimeExpired() is called
        // Player continues to see the question until time runs out
      } else if (isCorrect === true) {
        console.log('[QuizComponent] Correct answer - continuing in game');
        this.answers[this.currentQuestionIndex] = this.selectedAnswer;
        this.isAnswerCorrect = true;
        
        if (isFinalQuestion) {
          console.log(' [QuizComponent] Final question answered correctly - waiting for winner announcement');
        }
      }

      this.cdr.detectChanges();
    }
  }

  private handleSequentialQuizFinished(): void {
    console.log(' Sequential quiz finished');
    this.quizFinished = true;
    this.quizStarted = false;
    this.loading = false;
    
    const timeSpent = Math.max(1, Math.floor((Date.now() - this.quizStartTime) / 1000));
    this.calculateLocalScore(timeSpent).subscribe({
      next: (score) => {
        this.quizResult = { ...score, timeSpent };
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error calculating score:', err);
        this.handleEmergencyFallback(timeSpent);
      },
    });
  }

  private findCorrectAnswerIndex(correctAnswerText: string): number | null {
    const currentQuestion = this.questions[this.currentQuestionIndex];
    if (!currentQuestion?.options) {
      console.warn(' [QuizComponent] No options available for current question');
      return null;
    }
    
    // Try exact match first
    let index = currentQuestion.options.findIndex(opt => 
      opt.text.trim() === correctAnswerText.trim()
    );
    
    // If not found, try case-insensitive match
    if (index === -1) {
      index = currentQuestion.options.findIndex(opt => 
        opt.text.trim().toLowerCase() === correctAnswerText.trim().toLowerCase()
      );
    }
    
    // If still not found, try partial match
    if (index === -1) {
      index = currentQuestion.options.findIndex(opt => 
        opt.text.trim().includes(correctAnswerText.trim()) || 
        correctAnswerText.trim().includes(opt.text.trim())
      );
    }
    
    console.log(` [QuizComponent] Correct answer search:`, {
      correctAnswerText,
      options: currentQuestion.options.map(opt => opt.text),
      foundAtIndex: index
    });
    
    return index !== -1 ? index : null;
  }

  private startQuiz(mode: 'solo' | 'online' = 'solo'): void {
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
    this.isAnswerCorrect = null;
    this.quizStartTime = Date.now();
    this.questionStartTime = Date.now();

    this.sequentialQuizState = null;
    this.players = [];

    if (mode === 'online') {
      this.startSequentialQuizFlow();
    } else {
      this.startSoloQuizFlow();
    }
  }

  private startSoloQuizFlow(): void {
    console.log(' Starting solo quiz flow via WebSocket');
    this.quizId = `solo-quiz-${Date.now()}`;
    
    // Clear any previous online state
    this.sequentialQuizState = null;
    this.players = [];
    this.watchMode = false;
    
    // Check connection before proceeding
    this.socketService.getConnection().then(connected => {
      if (connected) {
        console.log(' WebSocket connected, loading solo questions');
        this.loadSoloQuestions();
      } else {
        console.error(' WebSocket connection failed for solo quiz');
        this.handleQuizError('Connection failed. Please refresh the page.');
      }
    }).catch(error => {
      console.error(' Connection error:', error);
      this.handleQuizError('Connection error. Please try again.');
    });
  }

  private loadSoloQuestions(): void {
    console.log(' Solo mode - loading questions for guest or authenticated user');
    
    this.quizService.getSoloQuestions(10).subscribe({
      next: (questions: Question[]) => {
        console.log(' Solo questions received via WebSocket:', questions?.length);
        if (questions && questions.length > 0) {
          this.questions = questions;
          this.answers = new Array(questions.length).fill(null);
          this.totalTime = 0;
          this.timeRemaining = 0;
          this.loading = false;
          this.quizStarted = true;
          console.log(` Solo quiz started with ${questions.length} questions`);
        } else {
          this.handleQuizError('No questions received for solo mode');
        }
        this.cdr.detectChanges();
      },
      error: (error: any) => {
        console.error(' Solo quiz start failed:', error);
        this.handleQuizError('Failed to load solo questions: ' + error.message);
      }
    });
  }

  private startSequentialQuizFlow(): void {
    if (this.mode !== 'online') return;
    
    this.quizId = `seq-quiz-${Date.now()}`;
    console.log(' Starting sequential quiz:', this.quizId);
    
    // Check connection before proceeding
    if (!this.socketService.isConnected()) {
      console.error(' WebSocket not connected for sequential quiz');
      this.handleQuizError('WebSocket connection lost. Please refresh the page.');
      return;
    }
    
    this.quizService.startSequentialQuiz(this.quizId, 10);
    this.loading = true;
  }

  private eliminatePlayer(reason: string): void {
    if (this.watchMode) return;

    this.watchMode = true;
    this.error = reason;

    console.log(` Player eliminated: ${reason}`);
    console.log(`Player now in watch mode - can only observe, not participate`);

    // Show watch mode immediately
    this.cdr.detectChanges();
  }

  private startTimer(duration: number): void {
    this.stopTimer();
    
    if (this.mode === 'online') {
      this.timeRemaining = duration;
    } else {
      this.timeRemaining = 0;
      return;
    }

    this.timerSubscription = interval(1000).subscribe(() => {
      if (this.gameOver || this.quizFinished) {
        return;
      }

      if (this.mode === 'online') {
        this.timeRemaining--;

        if (this.timeRemaining <= 0) {
          this.stopTimer();
          console.log(' Time expired for question', this.currentQuestionIndex);
          
          // Handle time expiry for all cases
          this.handleTimeExpired();
        }
      }

      this.updateProgress();
      this.cdr.detectChanges();
    });
  }

  private handleTimeExpired(): void {
    console.log(' Handling time expiry for question', this.currentQuestionIndex);
    
    if (this.watchMode) {
      // Watch mode - show correct answer immediately
      console.log(' Watch mode - time expired, showing correct answer');
      this.showCorrectAnswerToEliminatedPlayer();
      
      // Auto-proceed after delay
      setTimeout(() => {
        if (this.isFinalQuestion) {
          console.log(' Final question in watch mode - waiting for winner');
          this.loading = true;
        } else {
          this.proceedToNextQuestion();
        }
      }, 3000);
    } else if (this.isAnswerCorrect === false) {
      // Wrong answer was submitted - NOW eliminate the player
      console.log(' Wrong answer - eliminating player after time expiry');
      this.eliminatePlayer('Wrong answer! You have been eliminated.');
      this.showCorrectAnswerToEliminatedPlayer();
    } else if (!this.answerSubmitted) {
      // No answer submitted - eliminate player
      console.log(' No answer submitted - eliminating player');
      this.eliminatePlayer('Time expired! You have been eliminated.');
      this.showCorrectAnswerToEliminatedPlayer();
    } else {
      // Regular case - correct answer submitted
      console.log(' Time expired with correct answer');
      this.showAnswerFeedback = true;
    }
    
    this.cdr.detectChanges();
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
  
    if (this.mode === 'online' && this.sequentialQuizState) {
      this.progress = Math.round(((this.currentQuestionIndex + 1) / this.sequentialQuizState.totalQuestions) * 100);
    } else if (this.mode === 'online') {
      this.progress = Math.round(((this.currentQuestionIndex + 1) / (this.questions.length)) * 100);
    } else {
      this.progress = Math.round(((this.currentQuestionIndex + 1) / this.questions.length) * 100);
    }
  }

  selectAnswer(index: number): void {
    // Prevent answering in watch mode
    if (this.watchMode) {
      console.log(' Watch mode - cannot answer, only observe');
      return;
    }

    if (this.mode === 'solo') {
      if (this.showAnswerFeedback || this.answerSubmitted) {
        return;
      }
      this.submitSoloAnswer(index);
    } else {
      this.submitOnlineAnswer(index);
    }
    
    this.cdr.detectChanges();
  }

  private submitSoloAnswer(answerIndex: number): void {
    console.log(` [Solo] Answer selected: ${answerIndex} for question ${this.currentQuestionIndex + 1}`);
    
    if (this.showAnswerFeedback || this.answerSubmitted) {
      return;
    }

    this.selectedAnswer = answerIndex;
    this.answers[this.currentQuestionIndex] = answerIndex;
    this.answerSubmitted = true;

    // Always use WebSocket validation since backend removes isCorrect for security
    console.log(' Using WebSocket validation for solo answer');
    this.submitSoloAnswerForValidation(answerIndex);
    
    this.cdr.detectChanges();
  }

  private submitSoloAnswerForValidation(answerIndex: number): void {
    console.log(` Solo Submitting answer for validation: ${answerIndex}`);
    const timeSpent = Math.max(0.1, (Date.now() - this.questionStartTime) / 1000);
    
    this.quizService.submitSoloAnswer(
      this.quizId,
      this.currentQuestionIndex,
      answerIndex,
      timeSpent
    );
    
    // Show loading state while waiting for validation
    this.loading = true;
  }

  private submitOnlineAnswer(answerIndex: number): void {
    // Prevent any answering in watch mode
    if (this.watchMode) {
      console.log(' Watch mode - cannot answer, only observe');
      return;
    }
    
    if (this.answers[this.currentQuestionIndex] !== null) {
      console.log('Already answered this question');
      return;
    }
    
    if (this.gameOver || this.quizFinished) {
      console.log('Game is over');
      return;
    }
    
    if (this.showAnswerFeedback) {
      console.log('Answer feedback active');
      return;
    }
    
    if (this.timeRemaining <= 0) {
      console.log('Time expired');
      return;
    }

    console.log(` Submitting answer: ${answerIndex} for question ${this.currentQuestionIndex + 1}`);
    
    const timeSpent = Math.max(0.1, (Date.now() - this.questionStartTime) / 1000);
    
    this.quizService.submitSequentialAnswer(
      this.quizId,
      this.currentQuestionIndex,
      answerIndex,
      timeSpent
    );

    this.selectedAnswer = answerIndex;
    this.answerSubmitted = true;
    
    console.log(` Answer submitted in ${timeSpent.toFixed(2)}s`);
    
    this.cdr.detectChanges();
  }

  nextQuestion(): void {
    if (!this.questions?.length) return;
  
    this.showAnswerFeedback = false;
    this.currentCorrectAnswerIndex = null;
    this.isAnswerCorrect = null;
    this.selectedAnswer = null;
    this.answerSubmitted = false;
    this.error = null;
    this.loading = false;
  
    if (this.currentQuestionIndex < this.questions.length - 1) {
      this.currentQuestionIndex++;
      this.updateProgress();
      this.questionStartTime = Date.now();
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

  private handleGameOver(winner: GameWinner | null): void {
    if (this.gameOver) return;

    console.log(' Handling game over with winner:', winner);

    this.gameOver = true;
    this.gameWinner = winner;
    this.isWinner = !!(winner && winner.userId === this.currentUserId);

    this.stopTimer();

    if (winner) {
      console.log('Immediate winner: ${winner.username}');
      this.quizFinished = true;
      this.quizStarted = false;
      this.loading = false;
      this.error = null;
      
      console.log(' Game completed with fastest winner');
      this.cdr.detectChanges();
    } else {
      const timeSpent = Math.max(1, Math.floor((Date.now() - this.quizStartTime) / 1000));

      this.calculateLocalScore(timeSpent).subscribe({
        next: (score) => {
          this.quizResult = { ...score, timeSpent };
          this.quizFinished = true;
          this.quizStarted = false;
          this.loading = false;

          if (!winner) {
            this.error = "Game Over! It's a draw - no winner this round.";
          } else {
            this.error = null;
          }

          console.log(' Quiz completed successfully');
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error(' Error calculating score:', err);
          this.handleEmergencyFallback(timeSpent);
        },
      });
    }

    this.scrollToTop();
  }

  private handleEmergencyFallback(timeSpent: number): void {
    const totalQ = this.questions?.length || 0;
    const correctCount = this.answers
      ? this.answers.filter((a, i) => a !== null && a !== -1).length
      : 0;

    const fallbackScore: QuizResult = {
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

  private calculateLocalScore(timeSpent: number): Observable<QuizResult> {
    return new Observable((observer) => {
      try {
        const total = this.questions?.length || 0;
        
        if (this.mode === 'solo') {
          // For solo mode, we need to count actual correct answers
          // Since we don't have isCorrect on client side, we need to rely on the validation results
          let correctAnswers = 0;
          
          // Method 1: Use the tracked correctAnswersCount (if it's working correctly)
          if (this.correctAnswersCount > 0) {
            correctAnswers = this.correctAnswersCount;
            console.log(` Using tracked correct answers: ${correctAnswers}`);
          } 
          // Method 2: Fallback - count answers that were marked correct during validation
          else {
            // This is a fallback - you'd need to track which answers were actually correct
            // For now, we'll use a basic approach
            correctAnswers = this.answers.filter((answer, index) => {
              // If we have answer feedback stored, use that
              // You might need to add a way to track which answers were correct
              return answer !== null && answer !== -1;
            }).length;
            
            console.warn(' Using fallback correct answer calculation - may not be accurate');
          }
          
          const score = total ? Math.round((correctAnswers / total) * 100) : 0;
          
          const soloScore: QuizResult = {
            _id: `solo-${Date.now()}`,
            userId: this.currentUserId || 'anonymous',
            score: score,
            correctAnswers: correctAnswers,
            totalQuestions: total,
            timeSpent: timeSpent,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          
          console.log(` Solo score calculated: ${correctAnswers}/${total} = ${score}%`);
          observer.next(soloScore);
          observer.complete();
        } else {
          const basicScore = this.calculateBasicScore(total, timeSpent);
          observer.next(basicScore);
          observer.complete();
        }
      } catch (err) {
        console.error(' Error in calculateLocalScore:', err);
        const basicScore = this.calculateBasicScore(this.questions?.length || 0, timeSpent);
        observer.next(basicScore);
        observer.complete();
      }
    });
  }

  private calculateBasicScore(total: number, timeSpent: number): QuizResult {
    const answeredCount = this.answers?.filter(a => a !== null && a !== -1).length || 0;
    
    return {
      _id: 'local-' + Date.now(),
      userId: this.currentUserId || 'anonymous',
      score: total ? Math.round((answeredCount / total) * 100) : 0,
      correctAnswers: answeredCount,
      totalQuestions: total,
      timeSpent,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  submitQuiz(): void {
    if (this.quizFinished || this.loading) return;
    
    this.loading = true;
    this.stopTimer();

    const timeSpent = Math.max(1, Math.floor((Date.now() - this.quizStartTime) / 1000));

    this.calculateLocalScore(timeSpent).subscribe({
      next: (score) => this.finishQuizWithScore(score, timeSpent),
      error: () => {
        const fallback: QuizResult = {
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

  private finishQuizWithScore(score: QuizResult, timeSpent: number): void {
    this.quizResult = { ...score, timeSpent };
    this.quizFinished = true;
    this.quizStarted = false;
    this.loading = false;
    this.stopTimer();

    console.log(`Quiz finished! Score: ${score.score}%, Correct: ${score.correctAnswers}/${score.totalQuestions}, Time: ${timeSpent}s`);

    if (this.mode === 'solo' && this.currentUserId && !this.currentUserId.startsWith('guest-')) {
      this.saveScore(score, timeSpent);
    } else if (this.mode === 'solo' && this.currentUserId?.startsWith('guest-')) {
      console.log(' Guest user - skipping score save');
    }

    this.scrollToTop();
    this.cdr.detectChanges();
  }

  private handleQuizError(message: string): void {
    this.error = message;
    this.loading = false;
    this.quizStarted = false;
    this.cdr.detectChanges();
  }

  private saveScore(score: QuizResult, timeSpent: number): void {
    if (!this.currentUserId || this.currentUserId.startsWith('guest-')) {
      console.log(' Guest user - skipping score save');
      return;
    }

    const scoreData = {
      userId: this.currentUserId,
      quizId: this.quizId,
      score: score.score,
      correctAnswers: score.correctAnswers,
      totalQuestions: score.totalQuestions,
      timeSpent: timeSpent,
      answers: this.answers?.map((a, i) => ({
        questionId: this.questions?.[i]?._id || '',
        selectedOption: a !== null ? a : -1,
        isCorrect: this.questions?.[i]?.options?.[a ?? -1]?.isCorrect || false,
      })) || [],
    };

    this.scoreService.saveScore(scoreData).subscribe({
      next: (res) => console.log(' Score saved:', res),
      error: (err) => console.error(' Error saving score:', err),
    });
  }

  private scrollToTop(): void {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  private cleanupSubscriptions(): void {
    console.log(' Cleaning up all subscriptions');
    
    try {
      this.quizSubscription?.unsubscribe();
      this.timerSubscription?.unsubscribe();
      this.socketSubscriptions?.unsubscribe();
      
      // Clear all socket listeners to prevent memory leaks
      this.socketSubscriptions = new Subscription();
    } catch (e) {
      console.error(' Error during subscription cleanup:', e);
    }
    
    // Reset all quiz state
    this.resetQuizState();
  }

  private resetQuizState(): void {
    console.log(' Resetting quiz state');
    
    // Clear all arrays and objects
    this.questions = [];
    this.answers = [];
    this.onlineUsers = [];
    this.players = [];
    
    // Reset all state variables
    this.sequentialQuizState = null;
    this.quizResult = null;
    this.gameWinner = null;
    
    // Reset flags
    this.quizStarted = false;
    this.quizFinished = false;
    this.watchMode = false;
    this.gameOver = false;
    this.isWinner = false;
    this.showAnswerFeedback = false;
    this.answerSubmitted = false;
    this.loading = false;
    
    // Reset timers and progress
    this.currentQuestionIndex = 0;
    this.progress = 0;
    this.timeRemaining = 0;
    this.totalTime = 0;
    
    // Reset answer feedback
    this.selectedAnswer = null;
    this.currentCorrectAnswerIndex = null;
    this.isAnswerCorrect = null;
  }

  // Getters for template
  get canAnswer(): boolean {
    if (this.mode === 'solo') {
      return !this.showAnswerFeedback && 
             this.quizStarted &&
             !this.loading &&
             !this.quizFinished;
    } else {
      return !this.watchMode && 
             !this.gameOver && 
             this.answers[this.currentQuestionIndex] === null &&
             this.quizStarted &&
             !this.loading &&
             !this.showAnswerFeedback &&
             this.timeRemaining > 0;
    }
  }

  get isEliminated(): boolean {
    return this.watchMode;
  }

  get eliminationMessage(): string {
    return this.error || 'You have been eliminated from the quiz.';
  }

  get isFinalQuestion(): boolean {
    if (this.mode === 'online' && this.sequentialQuizState) {
      return this.currentQuestionIndex === this.sequentialQuizState.totalQuestions - 1;
    }
    return this.currentQuestionIndex === (this.questions?.length || 0) - 1;
  }

  getScoreClass(score: number): string {
    if (score >= 80) return 'score-excellent';
    if (score >= 50) return 'score-good';
    return 'score-poor';
  }

  getLetter(index: number): string {
    return String.fromCharCode(65 + index);
  }
  
  get totalQuestionsCount(): number {
    if (this.mode === 'online' && this.sequentialQuizState) {
      return this.sequentialQuizState.totalQuestions;
    }
    return this.questions?.length || 0;
  }
  
  get currentProgress(): number {
    return this.progress;
  }

  get isSequentialMode(): boolean {
    return this.mode === 'online' && this.sequentialQuizState !== null;
  }

  get currentQuestion(): Question | null {
    return this.questions[this.currentQuestionIndex] || null;
  }

  get hasCurrentQuestion(): boolean {
    return !!this.questions[this.currentQuestionIndex];
  }

  get sequentialState(): any {
    return this.sequentialQuizState;
  }

  get playerCount(): number {
    return this.players.length;
  }

  get feedbackMessage(): string {
    if (this.isAnswerCorrect === true) {
      return 'Correct!';
    } else if (this.isAnswerCorrect === false) {
      return 'Incorrect!';
    }
    return '';
  }

  get feedbackClass(): string {
    if (this.isAnswerCorrect === true) {
      return 'feedback-correct';
    } else if (this.isAnswerCorrect === false) {
      return 'feedback-incorrect';
    }
    return '';
  }
}