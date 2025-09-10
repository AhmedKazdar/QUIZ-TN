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
const mongoose_1 = require("mongoose");
let ScoreController = ScoreController_1 = class ScoreController {
    scoreService;
    logger = new common_1.Logger(ScoreController_1.name);
    constructor(scoreService) {
        this.scoreService = scoreService;
    }
    async calculateScore(userId) {
        try {
            if (!mongoose_1.Types.ObjectId.isValid(userId)) {
                throw new common_1.BadRequestException('Invalid userId format');
            }
            const score = await this.scoreService.calculateScore(userId);
            return score;
        }
        catch (error) {
            this.logger.error('calculateScore failed', error.stack);
            throw error;
        }
    }
};
exports.ScoreController = ScoreController;
__decorate([
    (0, common_1.Post)('calculate/:userId'),
    __param(0, (0, common_1.Param)('userId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ScoreController.prototype, "calculateScore", null);
exports.ScoreController = ScoreController = ScoreController_1 = __decorate([
    (0, common_1.Controller)('score'),
    __metadata("design:paramtypes", [score_service_1.ScoreService])
], ScoreController);
//# sourceMappingURL=score.controller.js.map