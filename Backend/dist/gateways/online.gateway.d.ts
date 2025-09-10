import { OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { UserService } from '../user/user.service';
export declare class OnlineGateway implements OnGatewayConnection, OnGatewayDisconnect {
    private readonly userService;
    server: Server;
    constructor(userService: UserService);
    private onlineUsersMap;
    getOnlineUsers(): string[];
    handleConnection(client: Socket): Promise<void>;
    handleDisconnect(client: Socket): Promise<void>;
    private broadcastOnlineUsers;
}
