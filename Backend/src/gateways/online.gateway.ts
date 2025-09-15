import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import * as jwt from 'jsonwebtoken';
import { UserService } from '../user/user.service';
import { Injectable } from '@nestjs/common';

@WebSocketGateway({
  cors: {
    origin: '*',
    credentials: true,
  },
  path: '/socket.io',
})
@Injectable()
export class OnlineGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(private readonly userService: UserService) {}

  private onlineUsersMap = new Map<string, string>(); // Socket ID -> Username

  getOnlineUsers(): string[] {
    return Array.from(this.onlineUsersMap.values());
  }

  async handleConnection(client: Socket) {
    const token = client.handshake.auth.token;

    if (!token) {
      console.log('No token provided, disconnecting client:', client.id);
      client.disconnect();
      return;
    }

    try {
      const payload: any = jwt.verify(
        token,
        process.env.JWT_SECRET || '123456',
      );
      const user = await this.userService.findById(payload.sub);

      if (!user) {
        console.log('User not found for ID:', payload.sub);
        client.disconnect();
        return;
      }

      // Check if the user is already connected
      const existingSocketId = [...this.onlineUsersMap.entries()].find(
        ([_, username]) => username === user.username,
      )?.[0];

      // If the user is already connected, disconnect the old socket
      if (existingSocketId) {
        console.log(
          `User ${user.username} already connected with socket ${existingSocketId}. Replacing with new socket ${client.id}.`,
        );
        this.onlineUsersMap.delete(existingSocketId);
        const oldSocket = this.server.sockets.sockets.get(existingSocketId);
        if (oldSocket) {
          oldSocket.disconnect();
        }
      }

      // Add user to the online users map
      this.onlineUsersMap.set(client.id, user.username);
      console.log(
        `Client connected: ${user.username} (Socket ID: ${client.id})`,
        `Online users: ${JSON.stringify(this.getOnlineUsers())}`,
      );

      // Broadcast the updated list of online users
      this.broadcastOnlineUsers();
    } catch (error) {
      console.error('Socket authentication failed:', error.message);
      client.emit('error', {
        message: 'Session expired, please log in again.',
      });
      client.disconnect();
    }
  }

  async handleDisconnect(client: Socket) {
    const username = this.onlineUsersMap.get(client.id);
    this.onlineUsersMap.delete(client.id);
    console.log(
      `Client disconnected: ${username} (Socket ID: ${client.id})`,
      `Online users: ${JSON.stringify(this.getOnlineUsers())}`,
    );
    this.broadcastOnlineUsers();
  }

  private broadcastOnlineUsers() {
    const users = this.getOnlineUsers();
    console.log('Broadcasting online users:', users);
    this.server.emit('onlineUsers', users);
  }
}
