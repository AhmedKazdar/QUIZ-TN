"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OnlineGateway = void 0;
const websockets_1 = require("@nestjs/websockets");
const common_1 = require("@nestjs/common");
const socket_io_1 = require("socket.io");
const jwt = require("jsonwebtoken");
const player_service_1 = require("../player/player.service");
let OnlineGateway = class OnlineGateway {
    playerService;
    server;
    onlineUsersMap = new Map();
    constructor(playerService) {
        this.playerService = playerService;
    }
    getOnlineUsers() {
        return Array.from(this.onlineUsersMap.values());
    }
    async handleConnection(client) {
        const token = client.handshake.auth?.token;
        if (!token) {
            console.log('No token provided, disconnecting client:', client.id);
            client.disconnect();
            return;
        }
        try {
            const payload = jwt.verify(token, process.env.JWT_SECRET || '123456');
            let player = null;
            if (payload?.sub) {
                try {
                    player = await this.playerService.findById(payload.sub);
                }
                catch (_) {
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
            const existingEntry = [...this.onlineUsersMap.entries()]
                .find(([_, u]) => u.userId === player._id.toString());
            if (existingEntry) {
                const [oldSocketId] = existingEntry;
                console.log(`Player ${player.username || player.phoneNumber} already connected. Replacing socket.`);
                this.onlineUsersMap.delete(oldSocketId);
                this.server.sockets.sockets.get(oldSocketId)?.disconnect();
            }
            this.onlineUsersMap.set(client.id, {
                userId: player._id.toString(),
                username: player.username || player.phoneNumber,
                socketId: client.id,
            });
            console.log(`Client connected: ${player.username || player.phoneNumber} (ID: ${player._id})`);
            this.server.emit('userConnected', {
                userId: player._id.toString(),
                username: player.username || player.phoneNumber,
                socketId: client.id,
            });
            this.broadcastOnlineUsers();
        }
        catch (error) {
            console.error('Socket authentication failed:', error.message);
            client.emit('error', { message: 'Session expired, please log in again.' });
            client.disconnect();
        }
    }
    async handleDisconnect(client) {
        const disconnectedUser = this.onlineUsersMap.get(client.id);
        this.onlineUsersMap.delete(client.id);
        console.log(`Client disconnected: ${disconnectedUser?.username || 'Unknown'} (Socket ID: ${client.id})`);
        if (disconnectedUser?.userId) {
            this.server.emit('userDisconnected', disconnectedUser.userId);
        }
        this.broadcastOnlineUsers();
    }
    broadcastOnlineUsers() {
        const users = this.getOnlineUsers();
        console.log('Broadcasting online users:', users);
        this.server.emit('onlineUsers', users);
    }
    handleGetOnlineUsers(client) {
        client.emit('onlineUsers', this.getOnlineUsers());
    }
};
exports.OnlineGateway = OnlineGateway;
__decorate([
    (0, websockets_1.WebSocketServer)(),
    __metadata("design:type", socket_io_1.Server)
], OnlineGateway.prototype, "server", void 0);
__decorate([
    (0, websockets_1.SubscribeMessage)('getOnlineUsers'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket]),
    __metadata("design:returntype", void 0)
], OnlineGateway.prototype, "handleGetOnlineUsers", null);
exports.OnlineGateway = OnlineGateway = __decorate([
    (0, websockets_1.WebSocketGateway)({
        namespace: '/online',
        cors: { origin: '*', credentials: true },
    }),
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [player_service_1.PlayerService])
], OnlineGateway);
//# sourceMappingURL=online.gateway.js.map