import { Component, OnInit, OnDestroy } from '@angular/core';
import { AuthService, User } from '../../services/auth.service';
import { Router } from '@angular/router';
import { SocketService, OnlineUser } from '../../services/socket.service';
import { Subscription, Observable } from 'rxjs';
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
  
  private subscriptions = new Subscription();
  
  constructor(
    private authService: AuthService,
    public socketService: SocketService,  // Make public for template access
    private router: Router
  ) {}

  ngOnInit(): void {
    this.authService.currentUser.subscribe(user => {
      this.currentUser = user;
      this.isAuthenticated = !!user;
      
      if (user) {
        this.setupSocketConnection();
      } else {
        this.cleanupSocketConnection();
      }
    });
  }

  private setupSocketConnection(): void {
    if (!this.enableWebSocket) {
      console.warn('WebSocket is disabled in environment configuration');
      return;
    }

    // Clear any existing subscriptions
    this.subscriptions.unsubscribe();
    this.subscriptions = new Subscription();

    // Connect to the WebSocket server
    this.socketService.connect();
    
    // Wait a short time before subscribing to ensure the connection is established
    const connectionCheck = setTimeout(() => {
      if (!this.socketService.isConnected()) {
        console.warn('Failed to establish WebSocket connection');
        return;
      }

      // Subscribe to online users updates
      const onlineUsersSub = this.socketService.getOnlineUsers().subscribe({
        next: (users: OnlineUser[]) => {
          // Only update if the list has actually changed
          const usersChanged = users.length !== this.onlineUsers.length ||
            users.some((user, index) => 
              !this.onlineUsers[index] || 
              user.userId !== this.onlineUsers[index]?.userId
            );
            
          if (usersChanged) {
            this.onlineUsers = [...users];
            if (environment.enableDebugLogging) {
              console.log('Online users updated:', this.onlineUsers);
            }
          }
        },
        error: (error) => {
          console.error('Error in online users subscription:', error);
        }
      });
      
      // Subscribe to connection status changes
      const connectionStatusSub = this.socketService.getConnectionStatus().subscribe({
        next: (isConnected: boolean) => {
          const wasConnected = this.isConnected;
          this.isConnected = isConnected;
          
          if (environment.enableDebugLogging) {
            console.log('Connection status changed:', isConnected ? 'Connected' : 'Disconnected');
          }
          
          // If we just reconnected, request the current online users
          if (isConnected && !wasConnected) {
            // Small delay to ensure the connection is fully established
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
      
      // Add subscriptions to the main subscription for cleanup
      this.subscriptions.add(onlineUsersSub);
      this.subscriptions.add(connectionStatusSub);
      
      // Initial request for online users
      this.socketService.requestOnlineUsers();
      
    }, 1000); // 1 second delay
    
    // Add timeout to subscriptions for cleanup
    this.subscriptions.add(new Subscription(() => clearTimeout(connectionCheck)));
  }

  private cleanupSocketConnection(): void {
    this.socketService.disconnect();
    this.onlineUsers = [];
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
    this.cleanupSocketConnection();
  }

/*   logout(): void {
    this.authService.logout();
    this.router.navigate(['/']);
  } */
}