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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var ScoreController_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScoreController = void 0;
const common_1 = require("@nestjs/common");
const score_service_1 = require("./score.service");
const score_schema_1 = require("./score.schema");
const mongoose_1 = require("mongoose");
const swagger_1 = require("@nestjs/swagger");
let ScoreController = ScoreController_1 = class ScoreController {
    scoreService;
    logger = new common_1.Logger(ScoreController_1.name);
    constructor(scoreService) {
        this.scoreService = scoreService;
    }
    async calculateScore(userId) {
        if (!mongoose_1.Types.ObjectId.isValid(userId)) {
            throw new common_1.BadRequestException('Invalid userId format');
        }
        return this.scoreService.calculateScore(userId);
    }
    async getUserRank(userId) {
        if (!mongoose_1.Types.ObjectId.isValid(userId)) {
            throw new common_1.BadRequestException('Invalid userId format');
        }
        return this.scoreService.getUserRank(userId);
    }
    async getLeaderboard(page = 1, limit = 10) {
        if (page < 1)
            page = 1;
        if (limit < 1 || limit > 100)
            limit = 10;
        return this.scoreService.getLeaderboard(page, limit);
    }
    async getTopScores(limit = 10) {
        if (limit < 1 || limit > 100)
            limit = 10;
        return this.scoreService.getTopRanking(limit);
    }
};
exports.ScoreController = ScoreController;
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Calculate score for a user' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Score calculated successfully' }),
    (0, swagger_1.ApiResponse)({ status: 400, description: 'Invalid user ID format' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'User not found' }),
    (0, common_1.Post)('calculate/:userId'),
    __param(0, (0, common_1.Param)('userId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ScoreController.prototype, "calculateScore", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Get user rank' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Returns user rank and total users' }),
    (0, swagger_1.ApiResponse)({ status: 400, description: 'Invalid user ID format' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'User score not found' }),
    (0, common_1.Get)('rank/:userId'),
    __param(0, (0, common_1.Param)('userId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ScoreController.prototype, "getUserRank", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Get leaderboard' }),
    (0, swagger_1.ApiQuery)({ name: 'page', required: false, type: Number, description: 'Page number (1-based)' }),
    (0, swagger_1.ApiQuery)({ name: 'limit', required: false, type: Number, description: 'Items per page' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Returns paginated leaderboard' }),
    (0, common_1.Get)('leaderboard'),
    __param(0, (0, common_1.Query)('page')),
    __param(1, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Number]),
    __metadata("design:returntype", Promise)
], ScoreController.prototype, "getLeaderboard", null);
__decorate([
    (0, common_1.Get)('top'),
    (0, swagger_1.ApiOperation)({ summary: 'Get top N scores' }),
    (0, swagger_1.ApiQuery)({ name: 'limit', required: false, type: Number, description: 'Number of top scores to return' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Returns top scores', type: [score_schema_1.Score] }),
    __param(0, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", Promise)
], ScoreController.prototype, "getTopScores", null);
exports.ScoreController = ScoreController = ScoreController_1 = __decorate([
    (0, swagger_1.ApiTags)('scores'),
    (0, common_1.Controller)('scores'),
    __metadata("design:paramtypes", [score_service_1.ScoreService])
], ScoreController);
//# sourceMappingURL=score.controller.js.map