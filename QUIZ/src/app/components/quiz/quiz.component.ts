import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription, Observable, interval } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { ScoreService } from '../../services/api/score.service';
import { SocketService, OnlineUser } from '../../services/socket.service';
import { QuizService, Question, QuizResult, GameWinner, SoloAnswerValidationRequest } from 'src/app/services/quiz.service';

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
  ) {
    this.isAuthenticated = this.authService.isAuthenticated();
    this.currentUserId = this.authService.currentUserValue?._id || null;
  }

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
        
        console.log(`🎯 Initializing ${mode} quiz...`);
        this.initializeQuiz();
      } else {
        this.router.navigate(['/home']);
      }
    });
  }

  ngOnDestroy(): void {
    this.quizService.disconnectSocket();
    this.cleanupSubscriptions();
    this.routeSubscription?.unsubscribe();
  }

  navigateToHome(): void {
    console.log('🚪 [FRONTEND] User navigating home - cleaning up quiz session');
    
    if (this.mode === 'online' && this.quizId) {
      this.quizService.leaveQuizSession(this.quizId).subscribe();
    }
    
    this.cleanupSubscriptions();
    this.stopTimer();
    
    this.router.navigate([this.isAuthenticated ? '/home' : '/']);
  }

  restartQuiz(): void {
    console.log('🔄 Restarting quiz in mode:', this.mode);
    
    if (this.mode === 'online' && this.quizId) {
      this.quizService.leaveQuizSession(this.quizId).subscribe();
    }
    
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
    console.log(`🔄 initializeQuiz called for ${this.mode} mode`);
    
    console.log('🎯 Connecting WebSocket for quiz');
    this.quizService.connectSocket(); 
    this.setupSocketListeners();
    
    if (this.mode === 'online' && !this.isAuthenticated) {
      this.router.navigate(['/login'], { queryParams: { returnUrl: '/quiz/online' } });
      return;
    }
    
    setTimeout(() => {
      this.startQuiz(this.mode);
    }, 1000);
  }

  private setupSocketListeners(): void {
    this.quizService.connectSocket();

    try {
      this.socketSubscriptions.unsubscribe();
    } catch (e) {}
    this.socketSubscriptions = new Subscription();

    // SOLO MODE LISTENERS
    const soloQuestionsLoadedSub = this.quizService.onSoloQuestionsLoaded().subscribe((data: any) => {
      console.log('✅ Solo questions loaded via WebSocket:', data);
      if (this.mode === 'solo' && data?.questions) {
        this.questions = data.questions;
        this.answers = new Array(data.questions.length).fill(null);
        this.totalTime = 0;
        this.timeRemaining = 0;
        this.loading = false;
        this.quizStarted = true;
        console.log(`✅ Solo quiz started with ${data.questions.length} questions (no timer)`);
        this.cdr.detectChanges();
      }
    });

    const soloQuestionsErrorSub = this.quizService.onSoloQuestionsError().subscribe((error: any) => {
      console.error('❌ Solo questions error:', error);
      if (this.mode === 'solo') {
        this.handleQuizError(error?.message || 'Failed to load solo questions');
      }
    });

    // ADD THIS: Solo answer validation listener
    const soloAnswerValidationSub = this.quizService.onSoloAnswerValidation().subscribe((data: any) => {
      console.log('✅ Solo answer validation result:', data);
      if (this.mode === 'solo' && data.validated) {
        this.handleSoloAnswerValidation(data);
      }
    });

    // ONLINE MODE LISTENERS
    const sequentialQuizStartedSub = this.quizService.onSequentialQuizStarted().subscribe((data: any) => {
      if (this.mode === 'online') {
        console.log('🎯 Sequential quiz started:', data);
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
      console.log('⏰ Time expired event received:', data);
      
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
        console.log('🎯 Sequential quiz joined:', data);
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
        console.log('❓ Next question received:', data);
        this.handleNextQuestion(data);
      }
    });

    const sequentialAnswerResultSub = this.quizService.onSequentialAnswerResult().subscribe((data: any) => {
      if (this.mode === 'online') {
        console.log('✅ Sequential answer result:', data);
        this.handleSequentialAnswerResult(data);
      }
    });

    const playerJoinedSequentialSub = this.quizService.onPlayerJoinedSequential().subscribe((data: any) => {
      if (this.mode === 'online' && this.sequentialQuizState) {
        console.log('👤 Player joined sequential:', data);
        this.sequentialQuizState.players = data.players;
        this.players = data.players;
        this.cdr.detectChanges();
      }
    });

    const playerAnsweredSequentialSub = this.quizService.onPlayerAnsweredSequential().subscribe((data: any) => {
      if (this.mode === 'online') {
        console.log('👥 Player answered in quiz:', data);
      }
    });

    const sequentialQuizFinishedSub = this.quizService.onSequentialQuizFinished().subscribe((data: any) => {
      if (this.mode === 'online') {
        console.log('🏁 Sequential quiz finished:', data);
        this.handleSequentialQuizFinished();
      }
    });

    const fastestWinnerSub = this.quizService.onFastestWinnerDeclared().subscribe((data: any) => {
      if (this.mode === 'online') {
        console.log('🏆 [FRONTEND] FASTEST WINNER EVENT RECEIVED:', data);
        
        if (data.winner && data.quizId === this.quizId) {
          console.log('🎯 [FRONTEND] Fastest winner detected - immediately ending game');
          
          this.gameOver = true;
          this.gameWinner = data.winner;
          this.isWinner = data.winner.userId === this.currentUserId;
          this.quizFinished = true;
          this.quizStarted = false;
          this.loading = false;
          
          this.stopTimer();
          this.cleanupSubscriptions();
          
          console.log(`🏆 [FRONTEND] Game over! Winner: ${data.winner.username}, Is me: ${this.isWinner}`);
          
          setTimeout(() => {
            this.cdr.detectChanges();
          }, 0);
        }
      }
    });

    const gameOverSub = this.quizService.onGameOver().subscribe((data: any) => {
      if (this.mode === 'online') {
        console.log('🛑 Game over event received:', data);
        this.handleGameOver(data?.winner);
      }
    });

    // Connection handler
    const connectionSub = this.quizService.getSocketConnectionStatus().subscribe((connected: boolean) => {
      if (connected && this.sequentialQuizState && !this.quizFinished) {
        console.log('🔗 Socket reconnected - rejoining sequential quiz');
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
      console.log('👥 Online users updated:', this.onlineUsers.length);
      this.cdr.detectChanges();
    });

    const statusSub = this.quizService.getSocketConnectionStatus().subscribe((connected) => {
      const wasConnected = this.isSocketConnected;
      this.isSocketConnected = connected;

      if (connected && !wasConnected) {
        setTimeout(() => this.quizService.requestOnlineUsers(), 300);
      }
    });

    // Add all subscriptions (INCLUDE the solo answer validation)
    this.socketSubscriptions.add(soloQuestionsLoadedSub);
    this.socketSubscriptions.add(soloQuestionsErrorSub);
    this.socketSubscriptions.add(soloAnswerValidationSub); // ADD THIS LINE
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

private findSoloCorrectAnswerIndex(correctAnswerText: string): number | null {
  const currentQuestion = this.questions[this.currentQuestionIndex];
  if (!currentQuestion?.options) {
    console.warn('❌ [Solo] No options available for current question');
    return null;
  }

  console.log('🔍 [Solo] Finding correct answer:', {
    correctAnswerText,
    availableOptions: currentQuestion.options.map(opt => opt.text)
  });

  // Normalize for comparison
  const normalizedCorrect = correctAnswerText.trim().toLowerCase();
  
  for (let i = 0; i < currentQuestion.options.length; i++) {
    const optionText = currentQuestion.options[i].text.trim().toLowerCase();
    
    // Exact match
    if (optionText === normalizedCorrect) {
      console.log(`✅ [Solo] Exact match found at index ${i}`);
      return i;
    }
    
    // Handle ellipsis and partial matches
    const cleanOption = optionText.replace('...', '').trim();
    const cleanCorrect = normalizedCorrect.replace('...', '').trim();
    
    if (cleanOption === cleanCorrect) {
      console.log(`✅ [Solo] Clean match found at index ${i}`);
      return i;
    }
    
    // Contains match
    if (optionText.includes(normalizedCorrect) || normalizedCorrect.includes(optionText)) {
      console.log(`✅ [Solo] Contains match found at index ${i}`);
      return i;
    }
  }

  console.warn('❌ [Solo] No matching answer found in options');
  return null;
}
private handleSoloAnswerValidation(data: any): void {
  console.log('✅ [Solo] Answer validation received:', data);
  const { questionIndex, isCorrect, correctAnswer } = data;
  
  if (questionIndex === this.currentQuestionIndex) {
    // Use the correct answer text from backend to find the index
    this.currentCorrectAnswerIndex = this.findSoloCorrectAnswerIndex(correctAnswer);
    
    console.log(`🎯 [Solo] Validation: ${isCorrect ? 'CORRECT' : 'INCORRECT'}, Correct index: ${this.currentCorrectAnswerIndex}`);
    
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
    if (!this.watchMode || !this.questions[this.currentQuestionIndex]) return;

    console.log('👀 Watch mode: Showing correct answer to eliminated player');
    
    const currentQuestion = this.questions[this.currentQuestionIndex];
    
    if (currentQuestion && currentQuestion.options) {
      const correctOption = currentQuestion.options.find(opt => opt.isCorrect);
      if (correctOption) {
        this.currentCorrectAnswerIndex = currentQuestion.options.indexOf(correctOption);
        console.log(`✅ Watch mode: Correct answer is option ${this.currentCorrectAnswerIndex}`);
      } else {
        console.log('❌ Watch mode: Could not find correct answer in options');
      }
    }
    
    this.showAnswerFeedback = true;
    this.cdr.detectChanges();
  }

  private handleNextQuestion(data: any): void {
    if (this.mode !== 'online') return;

    const { question, questionIndex, totalQuestions, startTime } = data || {};

    console.log(`🔄 Processing sequential question ${questionIndex + 1} of ${totalQuestions}`);

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
    this.watchMode = false;

    console.log(`✅ Loaded sequential question ${questionIndex + 1}`);

    this.timeRemaining = this.questionTimeLimit;
    this.questionStartTime = startTime || Date.now();
    this.startTimer(this.questionTimeLimit);

    this.updateProgress();
    this.cdr.detectChanges();
  }

  private handleSequentialAnswerResult(data: any): void {
    console.log('📥 [FRONTEND] Received answer result from server:', data);

    const { questionIndex, isCorrect, correctAnswer, timeSpent, isFinalQuestion } = data || {};

    if (questionIndex === this.currentQuestionIndex) {
      console.log(`✅ [FRONTEND] Processing answer result for current question`);
      
      this.currentCorrectAnswerIndex = this.findCorrectAnswerIndex(correctAnswer);
      
      console.log(`📊 [FRONTEND] Server validation:`, {
        isCorrect: isCorrect,
        correctAnswerText: correctAnswer,
        foundAtIndex: this.currentCorrectAnswerIndex
      });

      if (isCorrect === false && !this.watchMode) {
        console.log('❌ [FRONTEND] Wrong answer - immediate elimination');
        this.eliminatePlayer('Wrong answer! You have been eliminated.');
        this.showAnswerFeedback = true;
        
        if (this.currentCorrectAnswerIndex !== null) {
          console.log(`👀 Eliminated player sees correct answer: option ${this.currentCorrectAnswerIndex}`);
        }
      } else if (isCorrect === true) {
        console.log('✅ [FRONTEND] Correct answer - continuing in game');
        this.answers[this.currentQuestionIndex] = this.selectedAnswer;
        
        if (isFinalQuestion) {
          console.log('🎯 [FRONTEND] Final question answered correctly - waiting for winner announcement');
        }
      }

      this.cdr.detectChanges();
    }
  }

  private handleSequentialQuizFinished(): void {
    console.log('🏁 Sequential quiz finished');
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
    console.warn('❌ [FRONTEND] No options available for current question');
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
  
  console.log(`🔍 [FRONTEND] Correct answer search:`, {
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
  console.log('🎯 Starting solo quiz flow via WebSocket');
  this.quizId = `solo-quiz-${Date.now()}`;
  
  // Clear any previous online state
  this.sequentialQuizState = null;
  this.players = [];
  this.watchMode = false;
  
  this.quizService.getSoloQuestions(10).subscribe({
    next: (questions: Question[]) => {
      console.log('✅ Solo questions received via WebSocket:', questions?.length);
      if (questions && questions.length > 0) {
        this.questions = questions;
        this.answers = new Array(questions.length).fill(null);
        this.totalTime = 0;
        this.timeRemaining = 0; // No timer in solo mode
        this.loading = false;
        this.quizStarted = true;
        console.log(`✅ Solo quiz started with ${questions.length} questions`);
      } else {
        this.handleQuizError('No questions received for solo mode');
      }
      this.cdr.detectChanges();
    },
    error: (error: any) => {
      console.error('❌ Solo quiz start failed:', error);
      this.handleQuizError('Failed to load solo questions: ' + error.message);
    }
  });
}

  private startSequentialQuizFlow(): void {
    if (this.mode !== 'online') return;
    
    this.quizId = `seq-quiz-${Date.now()}`;
    console.log('🎯 Starting sequential quiz:', this.quizId);
    
    this.quizService.startSequentialQuiz(this.quizId, 10);
    this.loading = true;
  }

  private eliminatePlayer(reason: string): void {
    if (this.watchMode) return;

    this.watchMode = true;
    this.error = reason;

    console.log(`❌ Player eliminated: ${reason}`);

    if (this.currentCorrectAnswerIndex !== null) {
      console.log(`👀 Eliminated player sees correct answer: option ${this.currentCorrectAnswerIndex}`);
      this.showAnswerFeedback = true;
    }

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
      if (this.gameOver || this.quizFinished || this.showAnswerFeedback) {
        return;
      }

      if (this.mode === 'online') {
        this.timeRemaining--;

        if (this.timeRemaining <= 0) {
          this.stopTimer();
          if (!this.answerSubmitted && !this.watchMode) {
            console.log('⏰ Time expired without answer - eliminating player');
            this.eliminatePlayer('Time expired! You have been eliminated.');
          }
        }
      }

      this.updateProgress();
      this.cdr.detectChanges();
    });
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
    console.log(`🎯 [Solo] Answer selected: ${answerIndex} for question ${this.currentQuestionIndex + 1}`);
    
    if (this.showAnswerFeedback || this.answerSubmitted) {
      return;
    }

    this.selectedAnswer = answerIndex;
    this.answers[this.currentQuestionIndex] = answerIndex;
    this.answerSubmitted = true;

    // Always use WebSocket validation since backend removes isCorrect for security
    console.log('🔄 Using WebSocket validation for solo answer');
    this.submitSoloAnswerForValidation(answerIndex);
    
    this.cdr.detectChanges();
  }

private submitSoloAnswerForValidation(answerIndex: number): void {
  console.log(`🎯 [Solo] Submitting answer for validation: ${answerIndex}`);
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
    if (this.watchMode) {
      console.log('👀 Watch mode - cannot answer');
      return;
    }
    
    if (this.answers[this.currentQuestionIndex] !== null) {
      console.log('❌ Already answered this question');
      return;
    }
    
    if (this.gameOver || this.quizFinished) {
      console.log('❌ Game is over');
      return;
    }
    
    if (this.showAnswerFeedback) {
      console.log('❌ Answer feedback active');
      return;
    }
    
    if (this.timeRemaining <= 0) {
      console.log('❌ Time expired');
      return;
    }

    console.log(`🎯 [Online] Submitting answer: ${answerIndex} for question ${this.currentQuestionIndex + 1}`);
    
    const timeSpent = Math.max(0.1, (Date.now() - this.questionStartTime) / 1000);
    
    this.quizService.submitSequentialAnswer(
      this.quizId,
      this.currentQuestionIndex,
      answerIndex,
      timeSpent
    );

    this.selectedAnswer = answerIndex;
    this.answerSubmitted = true;
    
    console.log(`⏱️ Answer submitted in ${timeSpent.toFixed(2)}s`);
    
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

    console.log('🎯 Handling game over with winner:', winner);

    this.gameOver = true;
    this.gameWinner = winner;
    this.isWinner = !!(winner && winner.userId === this.currentUserId);

    this.stopTimer();

    if (winner) {
      console.log(`🏆 Immediate winner: ${winner.username}`);
      this.quizFinished = true;
      this.quizStarted = false;
      this.loading = false;
      this.error = null;
      
      console.log('✅ Game completed with fastest winner');
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

          console.log('✅ Quiz completed successfully');
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error('Error calculating score:', err);
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
        
        if (this.mode === 'solo' && this.isAuthenticated && this.currentUserId) {
          const correctAnswers = this.answers.filter((answer, index) => {
            if (answer === null || answer === undefined) return false;
            const correctIndex = this.questions[index].options.findIndex(opt => opt.isCorrect);
            return answer === correctIndex;
          }).length;
          
          const score = Math.round((correctAnswers / total) * 100);
          
          const soloScore: QuizResult = {
            _id: `solo-${Date.now()}`,
            userId: this.currentUserId,
            score: score,
            correctAnswers: correctAnswers,
            totalQuestions: total,
            timeSpent: timeSpent,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          
          observer.next(soloScore);
          observer.complete();
        } else {
          const basicScore = this.calculateBasicScore(total, timeSpent);
          observer.next(basicScore);
          observer.complete();
        }
      } catch (err) {
        console.error('Error in calculateLocalScore:', err);
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

    console.log(`🏁 Quiz finished! Score: ${score.score}%, Correct: ${score.correctAnswers}/${score.totalQuestions}, Time: ${timeSpent}s`);

    if (this.mode === 'solo' && this.currentUserId) {
      this.saveScore(score, timeSpent);
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
    if (!this.currentUserId) {
      console.log('👤 User not authenticated - skipping score save');
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
      this.timerSubscription?.unsubscribe();
      this.socketSubscriptions?.unsubscribe();
    } catch (e) {}
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
      return 'Correct! 🎉';
    } else if (this.isAnswerCorrect === false) {
      return 'Incorrect! ❌';
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