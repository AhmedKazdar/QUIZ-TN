import { Component, OnInit, OnDestroy } from '@angular/core';
import { AuthService, User } from '../../services/auth.service';
import { Router } from '@angular/router';
import { SocketService, OnlineUser } from '../../services/socket.service';
import { QuizTimeService } from '../../services/quiz-time.service';
import { Subscription, Observable, interval } from 'rxjs';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent implements OnInit, OnDestroy {
  currentUser: User | null = null;
  isAuthenticated = false;
  onlineUsers: OnlineUser[] = [];
  isConnected = false;
  enableWebSocket = environment.enableWebSocket;
  
  // Quiz time properties
  onlineModeAvailable = false;
  onlineModeMessage = 'Checking availability...';
  nextQuizTime: string | null = null;
  timeUntilNext: number | null = null;
  todaysSchedule: string[] = [];
  checkingAvailability = false;
  
  // TESTING: Developer override option
  enableDevOverride = environment.enableDevOverride || false; // Set this in environment files
  forceOnlineMode = false; // Toggle this to force online mode access
  
  // Countdown properties
  countdown: string = '';
  private countdownSubscription: Subscription | null = null;
  
  private subscriptions = new Subscription();
  
  constructor(
    private authService: AuthService,
    public socketService: SocketService,
    private quizTimeService: QuizTimeService,
    private router: Router
  ) {}

  ngOnInit(): void {
    // First validate the token
    this.authService.validateToken().subscribe(isValid => {
      if (!isValid) {
        console.error('Token validation failed');
        return;
      }
  
      this.authService.currentUser.subscribe(user => {
        this.currentUser = user;
        this.isAuthenticated = !!user;
        
        if (user) {
          this.setupSocketConnection();
          this.checkOnlineModeAvailability();
          this.loadTodaysSchedule();
        } else {
          this.cleanupSocketConnection();
        }
      });
    });
  }

  private setupSocketConnection(): void {
    if (!this.enableWebSocket) {
      console.warn('WebSocket is disabled in environment configuration');
      return;
    }

    this.subscriptions.unsubscribe();
    this.subscriptions = new Subscription();

    this.socketService.connect();
    
    const connectionCheck = setTimeout(() => {
      if (!this.socketService.isConnected()) {
        console.warn('Failed to establish WebSocket connection');
        return;
      }

      const onlineUsersSub = this.socketService.getOnlineUsers().subscribe({
        next: (users: OnlineUser[]) => {
          const usersChanged = users.length !== this.onlineUsers.length ||
            users.some((user, index) => 
              !this.onlineUsers[index] || 
              user.userId !== this.onlineUsers[index]?.userId
            );
            
          if (usersChanged) {
            this.onlineUsers = [...users];
          }
        },
        error: (error) => {
          console.error('Error in online users subscription:', error);
        }
      });
      
      const connectionStatusSub = this.socketService.getConnectionStatus().subscribe({
        next: (isConnected: boolean) => {
          const wasConnected = this.isConnected;
          this.isConnected = isConnected;
          
          if (isConnected && !wasConnected) {
            setTimeout(() => {
              this.socketService.requestOnlineUsers();
            }, 500);
          }
        },
        error: (error) => {
          console.error('Error in connection status subscription:', error);
          this.isConnected = false;
        }
      });
      
      this.subscriptions.add(onlineUsersSub);
      this.subscriptions.add(connectionStatusSub);
      this.socketService.requestOnlineUsers();
      
    }, 1000);
    
    this.subscriptions.add(new Subscription(() => clearTimeout(connectionCheck)));
  }

  private checkOnlineModeAvailability(): void {
    this.checkingAvailability = true;
    this.quizTimeService.isOnlineModeAvailable().subscribe({
      next: (result) => {
        // TESTING: Override availability if dev mode is enabled and forceOnlineMode is true
        if (this.enableDevOverride && this.forceOnlineMode) {
          this.onlineModeAvailable = true;
          this.onlineModeMessage = 'Online Mode (Developer Override)';
        } else {
          this.onlineModeAvailable = result.available;
          this.onlineModeMessage = result.message;
        }
        
        this.nextQuizTime = result.nextQuizTime || null;
        this.timeUntilNext = result.timeUntilNext || null;
        
        // Start countdown if not available (and not in dev override mode)
        if (!this.onlineModeAvailable && this.timeUntilNext && !this.forceOnlineMode) {
          this.startCountdown(this.timeUntilNext);
        } else {
          this.stopCountdown();
        }
        
        this.checkingAvailability = false;
      },
      error: (error) => {
        console.error('Error checking online mode availability:', error);
        
        // TESTING: In case of error, still allow override
        if (this.enableDevOverride && this.forceOnlineMode) {
          this.onlineModeAvailable = true;
          this.onlineModeMessage = 'Online Mode (Developer Override - Fallback)';
        } else {
          this.onlineModeAvailable = false;
          this.onlineModeMessage = 'Unable to check availability. Please try again.';
        }
        
        this.checkingAvailability = false;
        this.stopCountdown();
      }
    });
  }

  private loadTodaysSchedule(): void {
    this.quizTimeService.getTodaysSchedule().subscribe({
      next: (schedule) => {
        this.todaysSchedule = schedule.times;
        this.nextQuizTime = schedule.nextTime;
        this.timeUntilNext = schedule.timeUntilNext;
        
        // Start countdown if we have a next time (and not in dev override mode)
        if (this.timeUntilNext && !this.onlineModeAvailable && !this.forceOnlineMode) {
          this.startCountdown(this.timeUntilNext);
        }
      },
      error: (error) => {
        console.error('Error loading schedule:', error);
        this.todaysSchedule = [];
      }
    });
  }

  private startCountdown(minutesUntil: number): void {
    this.stopCountdown(); // Clear any existing countdown
    
    let totalSeconds = minutesUntil * 60;
    
    this.updateCountdownDisplay(totalSeconds);
    
    this.countdownSubscription = interval(1000).subscribe(() => {
      totalSeconds--;
      
      if (totalSeconds <= 0) {
        this.stopCountdown();
        this.checkOnlineModeAvailability(); // Recheck availability
        return;
      }
      
      this.updateCountdownDisplay(totalSeconds);
    });
  }

  private updateCountdownDisplay(totalSeconds: number): void {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    
    if (hours > 0) {
      this.countdown = `${hours}h ${minutes}m ${seconds}s`;
    } else if (minutes > 0) {
      this.countdown = `${minutes}m ${seconds}s`;
    } else {
      this.countdown = `${seconds}s`;
    }
  }

  private stopCountdown(): void {
    if (this.countdownSubscription) {
      this.countdownSubscription.unsubscribe();
      this.countdownSubscription = null;
    }
    this.countdown = '';
  }

  // TESTING: Toggle developer override
  toggleDevOverride(): void {
    this.forceOnlineMode = !this.forceOnlineMode;
    console.log(`Developer override: ${this.forceOnlineMode ? 'ENABLED' : 'DISABLED'}`);
    
    // Recheck availability to apply the override
    this.checkOnlineModeAvailability();
  }

  navigateToOnlineQuiz(): void {
    // TESTING: Allow access if dev override is enabled
    const canAccess = this.onlineModeAvailable || (this.enableDevOverride && this.forceOnlineMode);
    
    if (!canAccess) {
      alert(this.onlineModeMessage);
      return;
    }

    this.checkingAvailability = true;
    this.quizTimeService.isOnlineModeAvailable().subscribe({
      next: (result) => {
        this.checkingAvailability = false;
        
        // TESTING: Final check with override
        const finalAccess = result.available || (this.enableDevOverride && this.forceOnlineMode);
        
        if (finalAccess) {
          this.router.navigate(['/quiz', 'online']);
        } else {
          alert(result.message);
        }
      },
      error: (error) => {
        this.checkingAvailability = false;
        
        // TESTING: Even on error, allow if override is enabled
        if (this.enableDevOverride && this.forceOnlineMode) {
          this.router.navigate(['/quiz', 'online']);
        } else {
          alert('Error verifying quiz availability. Please try again.');
          console.error('Error verifying quiz availability:', error);
        }
      }
    });
  }

  refreshAvailability(): void {
    this.checkOnlineModeAvailability();
    this.loadTodaysSchedule();
  }

  isCurrentTime(quizTime: string): boolean {
    const currentTime = new Date();
    const currentHours = currentTime.getHours();
    const currentMinutes = currentTime.getMinutes();
    const currentTimeString = `${currentHours.toString().padStart(2, '0')}:${currentMinutes.toString().padStart(2, '0')}`;
    
    return quizTime === currentTimeString;
  }

  private cleanupSocketConnection(): void {
    this.socketService.disconnect();
    this.onlineUsers = [];
    this.stopCountdown();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
    this.cleanupSocketConnection();
    this.stopCountdown();
  }
}