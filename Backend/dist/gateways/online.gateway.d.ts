import { OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { PlayerService } from '../player/player.service';
interface OnlineUser {
    userId: string;
    username: string;
    socketId: string;
}
export declare class OnlineGateway implements OnGatewayConnection, OnGatewayDisconnect {
    private readonly playerService;
    server: Server;
    private onlineUsersMap;
    constructor(playerService: PlayerService);
    getOnlineUsers(): OnlineUser[];
    handleConnection(client: Socket): Promise<void>;
    handleDisconnect(client: Socket): Promise<void>;
    private broadcastOnlineUsers;
    handleGetOnlineUsers(client: Socket): void;
}
export {};
