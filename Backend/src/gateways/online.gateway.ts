import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
} from '@nestjs/websockets';
import { Injectable } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import * as jwt from 'jsonwebtoken';
import { PlayerService } from '../player/player.service';

interface OnlineUser {
  userId: string;
  username: string;
  socketId: string;
}

@WebSocketGateway({
   namespace: '/online', // Different namespace
  cors: { origin: '*', credentials: true },
})
@Injectable()
export class OnlineGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private onlineUsersMap = new Map<string, OnlineUser>();

  constructor(private readonly playerService: PlayerService) {}

  /** Returns all currently connected users. */
  getOnlineUsers(): OnlineUser[] {
    return Array.from(this.onlineUsersMap.values());
  }

  /** Handle new socket connection and authenticate with JWT. */
  async handleConnection(client: Socket): Promise<void> {
    const token = client.handshake.auth?.token;

    if (!token) {
      console.log('No token provided, disconnecting client:', client.id);
      client.disconnect();
      return;
    }

    try {
      // Verify JWT
      const payload: any = jwt.verify(token, process.env.JWT_SECRET || '123456');

      // Fetch player from DB by id (sub) or phoneNumber
      let player: any = null;
      if (payload?.sub) {
        try {
          player = await this.playerService.findById(payload.sub);
        } catch (_) {
          player = null;
        }
      }
      if (!player && payload?.phoneNumber) {
        player = await this.playerService.findByPhoneNumber(payload.phoneNumber);
      }

      if (!player) {
        console.log('Player not found for payload:', payload);
        client.disconnect();
        return;
      }

      // If user already connected, disconnect old socket
      const existingEntry = [...this.onlineUsersMap.entries()]
        .find(([_, u]) => u.userId === player._id.toString());
      if (existingEntry) {
        const [oldSocketId] = existingEntry;
        console.log(`Player ${player.username || player.phoneNumber} already connected. Replacing socket.`);
        this.onlineUsersMap.delete(oldSocketId);
        this.server.sockets.sockets.get(oldSocketId)?.disconnect();
      }

      // Store new connection
      this.onlineUsersMap.set(client.id, {
        userId: player._id.toString(),
        username: player.username || player.phoneNumber,
        socketId: client.id,
      });

      console.log(`Client connected: ${player.username || player.phoneNumber} (ID: ${player._id})`);
      // Notify all clients about the newly connected user
      this.server.emit('userConnected', {
        userId: player._id.toString(),
        username: player.username || player.phoneNumber,
        socketId: client.id,
      } as OnlineUser);
      this.broadcastOnlineUsers();
    } catch (error: any) {
      console.error('Socket authentication failed:', error.message);
      client.emit('error', { message: 'Session expired, please log in again.' });
      client.disconnect();
    }
  }

  /** Handle socket disconnection. */
  async handleDisconnect(client: Socket): Promise<void> {
    const disconnectedUser = this.onlineUsersMap.get(client.id);
    this.onlineUsersMap.delete(client.id);

    console.log(
      `Client disconnected: ${disconnectedUser?.username || 'Unknown'} (Socket ID: ${client.id})`,
    );
    // Notify all clients about the disconnected user
    if (disconnectedUser?.userId) {
      this.server.emit('userDisconnected', disconnectedUser.userId);
    }
    this.broadcastOnlineUsers();
  }

  /** Send current online users to all connected clients. */
  private broadcastOnlineUsers(): void {
    const users = this.getOnlineUsers();
    console.log('Broadcasting online users:', users);
    this.server.emit('onlineUsers', users);
  }

  /** Handle explicit request from client to get current online users */
  @SubscribeMessage('getOnlineUsers')
  handleGetOnlineUsers(client: Socket): void {
    client.emit('onlineUsers', this.getOnlineUsers());
  }
}
