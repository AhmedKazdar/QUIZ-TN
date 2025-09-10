import { io } from "socket.io-client";

class SocketService {
  socket = null;

  connect() {
    const token = localStorage.getItem("token");
    if (!token) return;

    this.socket = io("http://localhost:3001", {
      transports: ["websocket"],
      auth: { token },
      withCredentials: true,
    });
  }

  listenToOnlineUsers(callback) {
    if (!this.socket) return;
    this.socket.on("onlineUsers", callback);
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
    }
  }
}

const socketService = new SocketService();
export default socketService;
