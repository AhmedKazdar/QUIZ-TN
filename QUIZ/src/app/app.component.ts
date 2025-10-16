import { Component, OnInit, OnDestroy } from '@angular/core';
import { SocketService } from './services/socket.service';
import { AuthService } from './services/auth.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit, OnDestroy {
  title = 'QUIZ';
  private subscriptions: Subscription[] = [];
  
  constructor(
    private socketService: SocketService,
    private authService: AuthService,
  ) {}

   ngOnInit() {
    // Initialize socket service on app start
    this.socketService.initializeService().then(success => {
      console.log('Socket service initialized:', success);
    });
  }

  private async waitForAuthentication(): Promise<void> {
    const user = this.authService.currentUserValue;
    if (user) {
      console.log('✅ User already authenticated:', user.username);
      return;
    }

    console.log('⏳ Waiting for user authentication...');
    
    return new Promise((resolve) => {
      let authChecked = false;
      
      const currentUser = this.authService.currentUserValue;
      if (currentUser) {
        console.log('✅ User authenticated on initial check');
        authChecked = true;
        resolve();
        return;
      }

      const authSub = this.authService.currentUser.subscribe(user => {
        if (user && !authChecked) {
          authChecked = true;
          console.log('✅ User authenticated via subscription:', user.username);
          authSub.unsubscribe();
          resolve();
        }
      });

      setTimeout(() => {
        if (!authChecked) {
          authChecked = true;
          authSub.unsubscribe();
          console.log('⏰ Auth wait timeout - proceeding with socket initialization');
          resolve();
        }
      }, 5000);
    });
  }

  private async initializeSocketConnection(): Promise<void> {
    try {
      console.log('🔌 Initializing WebSocket connection from AppComponent...');
      
      if (this.socketService.isConnected()) {
        console.log('✅ WebSocket already connected, skipping initialization');
        return;
      }

      const connected = await this.socketService.initializeService();
      console.log(`🔌 AppComponent: WebSocket ${connected ? '✅ Connected' : '❌ Failed to connect'}`);
      
      if (connected) {
        console.log('🎯 WebSocket connection established successfully');
        
        setTimeout(() => {
          this.verifyConnection();
        }, 1000);
      } else {
        console.error('💥 Failed to establish WebSocket connection');
        this.socketService.debugConnectionIssues();
        
        setTimeout(() => {
          console.log('🔄 AppComponent: Attempting manual reconnect after failure');
          this.socketService.manualReconnect();
        }, 3000);
      }
    } catch (error) {
      console.error('🔌 AppComponent: WebSocket initialization error:', error);
    }
  }

  private setupConnectionMonitoring(): void {
    const statusSub = this.socketService.getConnectionStatus().subscribe(connected => {
      console.log(`🔌 AppComponent: WebSocket status: ${connected ? '✅ Connected' : '❌ Disconnected'}`);
      
      if (connected) {
        setTimeout(() => {
          console.log('👥 AppComponent: Requesting online users after connection');
          this.socketService.requestOnlineUsers();
        }, 1000);
      } else {
        setTimeout(() => {
          if (!this.socketService.isConnected()) {
            console.log('🔄 AppComponent: Attempting to reconnect due to disconnection...');
            this.socketService.manualReconnect();
          }
        }, 2000);
      }
    });

    const authSub = this.authService.currentUser.subscribe(user => {
      if (user) {
        console.log('✅ User authenticated in AppComponent - ensuring socket connection');
        this.socketService.ensureInitialized();
      } else {
        console.log('⚠️ User logged out in AppComponent');
      }
    });

    const onlineUsersSub = this.socketService.getOnlineUsers().subscribe(users => {
      console.log(`👥 AppComponent: Online users updated: ${users.length} users`);
    });

    this.subscriptions.push(statusSub, authSub, onlineUsersSub);

    const debugInterval = setInterval(() => {
      if (!this.socketService.isConnected()) {
        console.log('🔍 AppComponent: Periodic connection check - NOT CONNECTED');
        this.socketService.debugConnectionIssues();
      }
    }, 10000);

    this.subscriptions.push(new Subscription(() => {
      clearInterval(debugInterval);
    }));
  }

  private verifyConnection(): void {
    const health = this.socketService.checkConnectionHealth();
    console.log('🔍 Connection Health Check:', health);
    
    if (health.connected) {
      console.log('✅ WebSocket connection verified and healthy');
    } else {
      console.warn('⚠️ WebSocket connection may have issues');
    }
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
    this.subscriptions = [];
    
    console.log('🧹 AppComponent destroyed - cleaning up subscriptions');
  }

  public checkConnection(): void {
    this.socketService.debugConnectionIssues();
    this.verifyConnection();
  }

  public reconnect(): void {
    console.log('🔄 Manual reconnect requested from AppComponent');
    this.socketService.manualReconnect();
  }
}