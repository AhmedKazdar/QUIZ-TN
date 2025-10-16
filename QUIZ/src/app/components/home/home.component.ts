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

  async ngOnInit(): Promise<void> {
    // First validate the token
    this.authService.validateToken().subscribe(async isValid => {
      if (!isValid) {
        console.error('Token validation failed');
        return;
      }
  
      this.authService.currentUser.subscribe(async user => {
        this.currentUser = user;
        this.isAuthenticated = !!user;
        
        if (user) {
          await this.setupSocketConnection(); // Wait for connection
          this.checkOnlineModeAvailability();
          this.loadTodaysSchedule();
        } else {
          this.cleanupSocketConnection();
        }
      });
    });
  }

  private async setupSocketConnection(): Promise<void> {
    if (!this.enableWebSocket) {
      console.warn('WebSocket is disabled in environment configuration');
      return;
    }

    this.subscriptions.unsubscribe();
    this.subscriptions = new Subscription();

    try {
      // Wait for connection to be ready
      const connected = await this.socketService.getConnection();
      
      if (connected) {
        console.log('✅ HomeComponent: WebSocket connected, setting up listeners');
        this.setupSocketListeners();
      } else {
        console.warn('⚠️ HomeComponent: WebSocket not connected, skipping listeners');
      }
    } catch (error) {
      console.error('❌ HomeComponent: Failed to get WebSocket connection:', error);
    }
  }


   private setupSocketListeners(): void {
    const onlineUsersSub = this.socketService.getOnlineUsers().subscribe({
      next: (users: OnlineUser[]) => {
        this.onlineUsers = [...users];
        console.log(`👥 HomeComponent: Online users updated: ${users.length} users`);
      },
      error: (error) => {
        console.error('HomeComponent: Error in online users subscription:', error);
      }
    });
    const connectionStatusSub = this.socketService.getConnectionStatus().subscribe({
      next: (isConnected: boolean) => {
        this.isConnected = isConnected;
        console.log(`🔌 HomeComponent: Connection status: ${isConnected ? 'Connected' : 'Disconnected'}`);
        
        if (isConnected) {
          // Request online users when connected
          this.socketService.requestOnlineUsers();
        }
      },
      error: (error) => {
        console.error('HomeComponent: Error in connection status subscription:', error);
        this.isConnected = false;
      }
    });
    
    this.subscriptions.add(onlineUsersSub);
    this.subscriptions.add(connectionStatusSub);
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
    // Only cleanup subscriptions, don't disconnect the socket
    this.subscriptions.unsubscribe();
    this.onlineUsers = [];
    this.stopCountdown();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
    this.cleanupSocketConnection();
    this.stopCountdown();
  }
}