import {
  Component,
  OnInit,
  OnDestroy,
  ChangeDetectorRef,
} from '@angular/core';
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
  questionTimeLimit = 30;
  totalTime = 0;
  timeRemaining = 30;
  progress = 0;
  waitingForAnswer = false;
  answerWaitTime = 30;

  /*** User ***/
  isAuthenticated = false;
  currentUserId: string | null = null;

  /*** Winner & Game Over State ***/
  gameWinner: { userId: string, username: string } | null = null;
  gameOver = false;
  isWinner = false;

  /*** Internals ***/
  private quizSubscription: Subscription | null = null;
  private timerSubscription: Subscription | null = null;
  private answerWaitTimer: any = null;
  private quizStartTime = 0;
  private questionStartTime = 0;
  private quizId = '';
  private socketSubscriptions = new Subscription();
  onlineUsers: OnlineUser[] = [];
  isSocketConnected = false;
  
  constructor(
    private authService: AuthService,
    private questionService: QuestionService,
    private scoreService: ScoreService,
    private router: Router,
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef,
    private socketService: SocketService,
  ) {
    this.isAuthenticated = this.authService.isAuthenticated();
    this.currentUserId = this.authService.currentUserValue?._id || null;
  }

  /* ------------------- Lifecycle ------------------- */

  ngOnInit(): void {
    this.route.params.subscribe((params) => {
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
    
    // Clean up socket subscriptions
    this.socketSubscriptions.unsubscribe();
  }

  /* ------------------- Navigation ------------------- */

  navigateToHome(): void {
    this.router.navigate([this.isAuthenticated ? '/home' : '/']);
  }

  restartQuiz(): void {
    // Reset all quiz state
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
    this.loading = true;
    
    // Reload questions for a fresh quiz
    this.questionService.getQuestions(10).subscribe({
      next: (questions: Question[]) => {
        this.questions = questions;
        this.answers = new Array(questions.length).fill(null);
        this.totalTime = questions.length * (this.mode === 'online' ? this.questionTimeLimit : 30);
        this.timeRemaining = this.mode === 'online' ? this.questionTimeLimit : this.totalTime;
        this.quizStarted = true;
        this.loading = false;
        this.quizStartTime = Date.now();
        this.startTimer(this.totalTime);
      },
      error: (error) => {
        console.error('Failed to load questions:', error);
        this.loading = false;
        this.error = 'Failed to load questions. Please try again.';
        this.quizStarted = false;
        this.cdr.detectChanges();
      }
    });
  }

  /* ------------------- Quiz Flow ------------------- */

  private initializeQuiz(): void {
    if (this.mode === 'online' && !this.isAuthenticated) {
      this.router.navigate(['/login'], { queryParams: { returnUrl: '/quiz/online' } });
      return;
    }
  
    // Socket: only for online mode
    if (this.mode === 'online') {
      // Ensure connection
      this.socketService.connect();
  
      // Clear previous socket subs
      this.socketSubscriptions.unsubscribe();
      this.socketSubscriptions = new Subscription();
  
      // Subscribe to users
      const usersSub = this.socketService.getOnlineUsers().subscribe(users => {
        this.onlineUsers = users;
      });
  
      // Subscribe to connection status
      const statusSub = this.socketService.getConnectionStatus().subscribe(connected => {
        const wasConnected = this.isSocketConnected;
        this.isSocketConnected = connected;
  
        // On first connect (or reconnect), request list
        if (connected && !wasConnected) {
          setTimeout(() => this.socketService.requestOnlineUsers(), 300);
        }
      });

      // Listen for player elimination events
      const playerEliminatedSub = this.socketService.onEvent('playerEliminated')
        .subscribe((data: any) => {
          if (data.userId === this.currentUserId) return; // Skip self
          console.log(`Player ${data.userId} was eliminated: ${data.reason}`);
        });

      // Listen for correct answers from other players
      const playerAnsweredSub = this.socketService.onEvent('playerAnswered')
        .subscribe((data: any) => {
          if (data.userId === this.currentUserId) return; // Skip self
          console.log(`Player ${data.userId} answered question ${data.questionIndex} correctly`);
        });
  
      // Listen for player win events
      const playerWinSub = this.socketService.onEvent('playerWin')
        .subscribe((data: any) => {
          if (data.userId === this.currentUserId) return; // Skip self
          console.log(`Player ${data.username} won the game!`);
          this.handleOtherPlayerWin(data);
        });

      // Listen for game over events
      const gameOverSub = this.socketService.onEvent('gameOver')
        .subscribe((data: any) => {
          this.handleGameOver(data.winner);
        });

      this.socketSubscriptions.add(usersSub);
      this.socketSubscriptions.add(statusSub);
      this.socketSubscriptions.add(playerEliminatedSub);
      this.socketSubscriptions.add(playerAnsweredSub);
      this.socketSubscriptions.add(playerWinSub);
      this.socketSubscriptions.add(gameOverSub);
    }
  
    this.startQuiz(this.mode);
  }

  private handleOtherPlayerWin(winnerData: any): void {
    // Show notification that another player is about to win
    this.error = `${winnerData.username} answered the final question correctly!`;
    this.cdr.detectChanges();
  }
  
  private handleGameOver(winner: { userId: string, username: string } | null): void {
    if (this.gameOver) return;
    
    this.gameOver = true;
    this.gameWinner = winner;
    this.isWinner = winner ? winner.userId === this.currentUserId : false;
    
    // Stop all timers
    this.stopTimer();
    
    const timeSpent = Math.max(1, Math.floor((Date.now() - this.quizStartTime) / 1000));
    
    this.calculateLocalScore(timeSpent).subscribe({
      next: (score) => {
        this.quizResult = { ...score, timeSpent };
        this.quizFinished = true;
        this.quizStarted = false;
        this.loading = false;
        
        if (!winner) {
          this.error = "Game Over! It's a draw - no winner this round.";
        }
        
        this.cdr.detectChanges();
      }
    });
    
    this.scrollToTop();
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
    this.quizStartTime = Date.now();
    this.loadQuestions();
  }

  private loadQuestions(): void {
    this.questionService.getQuestions(10).subscribe({
      next: (questions) => {
        this.questions = questions;
        this.answers = new Array(questions.length).fill(null);

        this.totalTime = questions.length * (this.mode === 'online' ? this.questionTimeLimit : 30);
        this.timeRemaining = this.mode === 'online' ? this.questionTimeLimit : this.totalTime;

        this.startTimer(this.totalTime);
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.error = 'Failed to load questions. Please try again.';
        this.quizStarted = false;
      },
    });
  }

  private submitQuiz(): void {
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
          totalQuestions: this.questions.length,
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

    if (this.mode === 'online' && this.currentUserId) this.saveScore(score, timeSpent);

    this.scrollToTop();
    this.cdr.detectChanges();
  }

  /* ------------------- Timer Logic ------------------- */

  private startTimer(duration: number): void {
    this.stopTimer();
    this.timeRemaining = duration;
    this.questionStartTime = Date.now();
  
    this.timerSubscription = interval(1000).subscribe(() => {
      // Don't update timer if in watch mode or game is over
      if (this.watchMode || this.gameOver) {
        this.stopTimer();
        return;
      }
  
      if (this.mode === 'online') {
        const elapsed = Math.floor((Date.now() - this.questionStartTime) / 1000);
        this.timeRemaining = Math.max(0, this.questionTimeLimit - elapsed);
  
        if (this.timeRemaining <= 0) {
          // Time's up - now check all answers and eliminate wrong answers
          this.stopTimer();
          
          // If this is the last question and no one won yet
          const isLastQuestion = this.currentQuestionIndex === this.questions.length - 1;
          if (isLastQuestion && !this.gameOver) {
            // LAST QUESTION SPECIAL HANDLING
            const playerAnswered = this.answers[this.currentQuestionIndex] !== null;
            
            if (playerAnswered) {
              const current = this.questions[this.currentQuestionIndex];
              const selectedAnswer = this.answers[this.currentQuestionIndex];
              
              if (selectedAnswer !== null && selectedAnswer !== undefined) {
                const isCorrect = current.options[selectedAnswer]?.isCorrect;
                if (isCorrect) {
                  // Player answered correctly on last question - they win!
                  this.declareWinner();
                  return;
                } else {
                  // Wrong answer on last question - eliminate
                  this.eliminatePlayer("Wrong answer on final question! Game over.");
                  // On last question, if everyone is eliminated, we need to handle draw
                  this.handleDrawScenario();
                  return;
                }
              }
            }
            
            // If we reach here, no one answered the last question correctly before time expired
            // This is a draw scenario - no winner
            this.handleDrawScenario();
            return;
          }
          
          // For non-last questions, proceed with normal elimination logic
          const playerAnswered = this.answers[this.currentQuestionIndex] !== null;
          
          if (playerAnswered) {
            // Check if the answer was correct
            const current = this.questions[this.currentQuestionIndex];
            const selectedAnswer = this.answers[this.currentQuestionIndex];
            
            if (selectedAnswer !== null && selectedAnswer !== undefined) {
              const isCorrect = current.options[selectedAnswer]?.isCorrect;
              
              if (!isCorrect) {
                // Wrong answer - eliminate now that time is up
                this.eliminatePlayer("Wrong answer! You've been eliminated.");
                
                if (this.socketService.isConnected() && this.currentUserId) {
                  this.socketService.emitPlayerAnswered({
                    userId: this.currentUserId,
                    questionIndex: this.currentQuestionIndex,
                    isCorrect: false
                  });
                }
              } else {
                // Correct answer - notify server
                if (this.socketService.isConnected() && this.currentUserId) {
                  this.socketService.emitPlayerAnswered({
                    userId: this.currentUserId,
                    questionIndex: this.currentQuestionIndex,
                    isCorrect: true
                  });
                }
              }
            }
          } else {
            // No answer - eliminate for not answering
            this.answers[this.currentQuestionIndex] = -1;
            this.eliminatePlayer("Time's up! You've been eliminated for not answering.");
          }
          
          // Wait a moment to show feedback, then proceed (only for non-last questions)
          setTimeout(() => {
            if (!this.watchMode && this.currentQuestionIndex < this.questions.length - 1) {
              this.nextQuestion();
            } else if (this.watchMode && this.currentQuestionIndex < this.questions.length - 1) {
              this.nextQuestion();
            } else {
              this.submitQuiz();
            }
          }, 3000);
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
    });
  }

  private stopTimer(): void {
    this.timerSubscription?.unsubscribe();
    this.timerSubscription = null;
  }

  private updateProgress(): void {
    if (!this.questions.length) {
      this.progress = 0;
      return;
    }

    if (this.mode === 'online') {
      this.progress = Math.round(((this.currentQuestionIndex + 1) / this.questions.length) * 100);
    } else {
      const elapsed = this.totalTime - this.timeRemaining;
      this.progress = this.totalTime
        ? Math.min(100, Math.round((elapsed / this.totalTime) * 100))
        : 0;
    }
  }




  /////////////Draw scenario //////////

  private handleDrawScenario(): void {
    if (this.gameOver) return;
    
    this.gameOver = true;
    this.stopTimer();
    
    // No winner - it's a draw
    const timeSpent = Math.max(1, Math.floor((Date.now() - this.quizStartTime) / 1000));
    
    // Notify all players that it's a draw
    if (this.socketService.isConnected()) {
      this.socketService.emitGameOver({
        winner: null // null indicates draw
      });
    }
    
    // Calculate final score
    this.calculateLocalScore(timeSpent).subscribe({
      next: (score) => {
        this.quizResult = { ...score, timeSpent };
        this.quizFinished = true;
        this.quizStarted = false;
        this.loading = false;
        this.error = "Time's up! No one answered the final question correctly. It's a draw!";
        this.cdr.detectChanges();
      }
    });
  }


  private eliminatePlayer(reason: string): void {
    if (this.watchMode) return;
    
    this.watchMode = true;
    this.error = reason;
    // Don't stop timer - let it continue so player can see what happens
    // this.stopTimer();
    
    // Notify server that this player is eliminated
    if (this.socketService.isConnected() && this.currentUserId) {
      this.socketService.emitPlayerEliminated({
        userId: this.currentUserId,
        questionIndex: this.currentQuestionIndex,
        reason: reason
      });
    }
    
    this.cdr.detectChanges();
  }

  private markQuestionAsWrong(): void {
    if (this.mode === 'online' && this.selectedAnswer === null && !this.watchMode) {
      this.answers[this.currentQuestionIndex] = -1;
      this.eliminatePlayer("Time's up! You've been eliminated for not answering.");
    }
  }

  /* ------------------- Navigation Between Questions ------------------- */
  nextQuestion(): void {
    if (!this.questions.length) return;
  
    // Reset selection and clear errors
    this.selectedAnswer = null;
    this.error = null;
    
    if (this.currentQuestionIndex < this.questions.length - 1) {
      this.currentQuestionIndex++;
      this.updateProgress();
      if (this.mode === 'online') {
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
    if (index >= 0 && index < this.questions.length) {
      this.currentQuestionIndex = index;
      this.selectedAnswer = this.answers[this.currentQuestionIndex];
      this.scrollToTop();
    }
  }

  /* ------------------- Answer Handling ------------------- */

  selectAnswer(index: number): void {
    if (this.watchMode || this.answers[this.currentQuestionIndex] !== null || this.gameOver) return;
  
    this.selectedAnswer = index;
    this.answers[this.currentQuestionIndex] = index;
  
    if (this.mode === 'online') {
      const current = this.questions[this.currentQuestionIndex];
      const isCorrect = current.options[index]?.isCorrect;
  
      if (isCorrect) {
        // Check if this is the LAST QUESTION - speed race condition
        const isLastQuestion = this.currentQuestionIndex === this.questions.length - 1;
        
        if (isLastQuestion) {
          // LAST QUESTION: First correct answer wins the entire game!
          this.declareWinner();
          return;
        } else {
          // Regular question: store answer but wait for time to expire for feedback
          this.answers[this.currentQuestionIndex] = index;
          
          // Notify server about correct answer (but not winner yet)
          if (this.socketService.isConnected() && this.currentUserId) {
            this.socketService.emitPlayerAnswered({
              userId: this.currentUserId,
              questionIndex: this.currentQuestionIndex,
              isCorrect: true
            });
          }
          
          // Clear any previous error messages
          this.error = null;
        }
      } else {
        // Wrong answer - eliminate immediately on last question, otherwise wait for time
        if (this.currentQuestionIndex === this.questions.length - 1) {
          // Last question wrong answer - immediate elimination
          this.eliminatePlayer("Wrong answer on final question! Game over.");
        } else {
          // For non-last questions, wrong answers are handled when time expires
          // But we can clear any previous errors
          this.error = null;
        }
      }
    } else {
      // Solo mode behavior remains the same
      this.cdr.detectChanges();
    }
  }

  private declareWinner(): void {
    if (this.gameOver || !this.currentUserId) return;
  
    this.gameOver = true;
    this.isWinner = true;
    
    const currentUser = this.authService.currentUserValue;
    const winnerData = {
      userId: this.currentUserId,
      username: currentUser?.username || 'Unknown Player'
    };
    
    this.gameWinner = winnerData;
    
    // Stop all timers
    this.stopTimer();
    
    // Notify all other players that this player won
    if (this.socketService.isConnected()) {
      this.socketService.emitPlayerWin({
        userId: this.currentUserId,
        username: winnerData.username,
        questionIndex: this.currentQuestionIndex
      });
      
      this.socketService.emitGameOver({
        winner: winnerData
      });
    }
    
    // Calculate and show final score
    const timeSpent = Math.max(1, Math.floor((Date.now() - this.quizStartTime) / 1000));
    this.calculateLocalScore(timeSpent).subscribe({
      next: (score) => {
        this.quizResult = { ...score, timeSpent };
        this.quizFinished = true;
        this.quizStarted = false;
        this.loading = false;
      },
      error: () => {
        const fallback: Score = {
          _id: 'local-' + Date.now(),
          userId: this.currentUserId || 'anonymous',
          score: 100, // Winner gets 100%
          correctAnswers: this.questions.length,
          totalQuestions: this.questions.length,
          timeSpent,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        this.quizResult = fallback;
        this.quizFinished = true;
        this.quizStarted = false;
        this.loading = false;
      }
    });
    
    this.scrollToTop();
    this.cdr.detectChanges();
  }

  /* ------------------- Helpers ------------------- */

  private calculateLocalScore(timeSpent: number): Observable<Score> {
    return new Observable((observer) => {
      try {
        const total = this.questions.length;
        const correct = this.questions.reduce((acc, q, i) => {
          const sel = this.answers[i];
          return sel !== null && sel !== -1 && q.options?.[sel]?.isCorrect ? acc + 1 : acc;
        }, 0);

        const result: Score = {
          _id: 'local-' + Date.now(),
          userId: this.currentUserId || 'anonymous',
          score: Math.round((correct / total) * 100),
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
    if (this.currentQuestionIndex < this.questions.length - 1) {
      this.nextQuestion();
    } else {
      this.submitQuiz();
    }
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
      answers: this.answers.map((a, i) => ({
        questionId: this.questions[i]?._id || '',
        selectedOption: a,
        isCorrect: this.questions[i]?.options?.[a ?? -1]?.isCorrect || false,
      })),
    };

    this.scoreService.saveScore(scoreData).subscribe({
      next: (res) => console.log('Score saved:', res),
      error: (err) => console.error('Error saving score:', err),
    });
  }

  private scrollToTop(): void {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  private cleanupSubscriptions(): void {
    this.quizSubscription?.unsubscribe();
    this.timerSubscription?.unsubscribe();
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
}