import { io } from "socket.io-client";

class SocketService {
  socket = null;
  isConnecting = false;
  listeners = new Map();

  constructor() {
    this.initialize();
  }

  initialize() {
    const token = localStorage.getItem("token");
    if (!token || this.isConnected() || this.isConnecting) {
      console.log('WebSocket: Not initializing - missing token or already connected/connecting');
      return;
    }

    console.log('WebSocket: Initializing connection...');
    this.isConnecting = true;
    
    try {
      // Use the same URL as the API but with ws:// protocol
      const apiUrl = new URL(import.meta.env.VITE_API_URL || 'http://localhost:3001');
      const wsProtocol = apiUrl.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${wsProtocol}//${apiUrl.host}`;
      
      this.socket = io(wsUrl, {
        path: '/socket.io',
        transports: ["websocket"],
        auth: { token },
        withCredentials: true,
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 10000,
      });
      
      console.log('WebSocket: Connection initialized to', wsUrl);
    } catch (error) {
      console.error('WebSocket: Error initializing connection:', error);
      this.isConnecting = false;
      throw error;
    }

    this.socket.on("connect", () => {
      console.log("WebSocket connected");
      this.isConnecting = false;
      // Re-register all listeners after reconnection
      this.listeners.forEach((callback, event) => {
        this.socket.on(event, callback);
      });
    });

    this.socket.on("disconnect", (reason) => {
      console.log("WebSocket disconnected:", reason);
      if (reason === "io server disconnect" || reason === "io client disconnect") {
        // Try to reconnect after a delay
        setTimeout(() => this.initialize(), 1000);
      }
    });

    this.socket.on("connect_error", (error) => {
      console.error("WebSocket connection error:", error);
      this.isConnecting = false;
      // Try to reconnect after a delay
      setTimeout(() => this.initialize(), 5000);
    });
  }

  isConnected() {
    return this.socket?.connected === true;
  }

  on(event, callback) {
    if (!this.socket) {
      this.initialize();
    }
    this.listeners.set(event, callback);
    if (this.socket) {
      this.socket.on(event, callback);
    }
  }

  off(event) {
    this.listeners.delete(event);
    if (this.socket) {
      this.socket.off(event);
    }
  }

  listenToOnlineUsers(callback) {
    this.on("onlineUsers", callback);
  }

  disconnect() {
    if (this.socket) {
      this.socket.off();
      this.socket.disconnect();
      this.socket = null;
      this.isConnecting = false;
    }
  }

  // Add this method to expose the socket instance if needed
  getSocket() {
    return this.socket;
  }
}

const socketService = new SocketService();

export default socketService;
