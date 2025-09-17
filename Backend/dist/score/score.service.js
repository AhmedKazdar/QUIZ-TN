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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScoreService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const score_schema_1 = require("./score.schema");
const user_schema_1 = require("../user/user.schema");
let ScoreService = class ScoreService {
    scoreModel;
    responseModel;
    userModel;
    constructor(scoreModel, responseModel, userModel) {
        this.scoreModel = scoreModel;
        this.responseModel = responseModel;
        this.userModel = userModel;
    }
    async syncUserScore(userId) {
        try {
            if (!mongoose_2.Types.ObjectId.isValid(userId)) {
                throw new common_1.BadRequestException('Invalid userId format');
            }
            const objectId = new mongoose_2.Types.ObjectId(userId);
            const userExists = await this.userModel.findById(objectId);
            if (!userExists) {
                throw new common_1.NotFoundException('User not found');
            }
            console.log('Syncing score for user:', objectId.toString());
            const responses = (await this.responseModel
                .find({ userId: objectId })
                .sort({ createdAt: -1 })
                .exec());
            console.log('Fetched Responses:', responses.length);
            const uniqueResponses = [];
            const seenQuestionIds = new Set();
            for (const response of responses) {
                if (!seenQuestionIds.has(response.questionId.toString())) {
                    uniqueResponses.push(response);
                    seenQuestionIds.add(response.questionId.toString());
                }
            }
            console.log('Unique Responses:', uniqueResponses.length);
            const correctAnswers = uniqueResponses.filter((r) => r.isCorrect).length;
            console.log('Correct Responses Count:', correctAnswers);
            const updatedScore = await this.scoreModel.findOneAndUpdate({ userId: objectId }, { score: correctAnswers, createdAt: new Date() }, { upsert: true, new: true });
            const populatedScore = await this.scoreModel
                .findById(updatedScore._id)
                .populate('userId', 'username')
                .exec();
            if (!populatedScore || !populatedScore.userId) {
                throw new common_1.InternalServerErrorException('User details could not be populated for the score.');
            }
            console.log('Synced Score:', populatedScore.score);
            return populatedScore;
        }
        catch (error) {
            console.error('Error syncing score:', error.message, error.stack);
            throw new common_1.InternalServerErrorException('Failed to sync score');
        }
    }
    async calculateScore(userId) {
        try {
            if (!mongoose_2.Types.ObjectId.isValid(userId)) {
                throw new common_1.BadRequestException('Invalid userId format');
            }
            const objectId = new mongoose_2.Types.ObjectId(userId);
            const userExists = await this.userModel.findById(objectId);
            if (!userExists) {
                throw new common_1.NotFoundException('User not found');
            }
            console.log('Fetching responses for user:', objectId.toString());
            const responses = (await this.responseModel
                .find({ userId: objectId })
                .sort({ createdAt: -1 })
                .exec());
            console.log('Fetched Responses:', responses.length);
            const uniqueResponses = [];
            const seenQuestionIds = new Set();
            for (const response of responses) {
                if (!seenQuestionIds.has(response.questionId.toString())) {
                    uniqueResponses.push(response);
                    seenQuestionIds.add(response.questionId.toString());
                }
            }
            console.log('Unique Responses:', uniqueResponses.length);
            const correctAnswers = uniqueResponses.filter((r) => r.isCorrect).length;
            console.log('Correct Responses Count:', correctAnswers);
            const updatedScore = await this.scoreModel.findOneAndUpdate({ userId: objectId }, { score: correctAnswers, createdAt: new Date() }, { upsert: true, new: true });
            const populatedScore = await this.scoreModel
                .findById(updatedScore._id)
                .populate('userId', 'username')
                .exec();
            if (!populatedScore || !populatedScore.userId) {
                throw new common_1.InternalServerErrorException('User details could not be populated for the score.');
            }
            console.log('Calculated Score:', populatedScore.score);
            return populatedScore;
        }
        catch (error) {
            console.error('Error during score calculation:', error.message, error.stack);
            throw new common_1.InternalServerErrorException('An error occurred while calculating the score. Please try again later.');
        }
    }
    async getTopRanking(limit = 5) {
        try {
            const topScores = await this.scoreModel
                .find()
                .sort({ score: -1, createdAt: -1 })
                .limit(limit)
                .populate('userId', 'username')
                .exec();
            console.log('Fetched top rankings:', topScores);
            return topScores;
        }
        catch (error) {
            console.error('Error fetching top rankings:', error.message, error.stack);
            throw new common_1.InternalServerErrorException('Failed to fetch top rankings');
        }
    }
    async getUserRank(userId) {
        if (!mongoose_2.Types.ObjectId.isValid(userId)) {
            throw new common_1.BadRequestException('Invalid userId format');
        }
        const scores = await this.scoreModel
            .find()
            .sort({ score: -1, updatedAt: 1 })
            .exec();
        const userIndex = scores.findIndex(score => score.userId.toString() === userId);
        if (userIndex === -1) {
            throw new common_1.NotFoundException('User score not found');
        }
        return {
            rank: userIndex + 1,
            totalUsers: scores.length
        };
    }
    async getLeaderboard(page = 1, limit = 10) {
        const skip = (page - 1) * limit;
        const total = await this.scoreModel.countDocuments();
        const totalPages = Math.ceil(total / limit);
        const scores = await this.scoreModel.aggregate([
            {
                $lookup: {
                    from: 'users',
                    localField: 'userId',
                    foreignField: '_id',
                    as: 'user',
                },
            },
            { $unwind: '$user' },
            { $match: { 'user.role': user_schema_1.UserRole.USER } },
            { $sort: { score: -1, updatedAt: 1 } },
            { $skip: skip },
            { $limit: limit },
            {
                $project: {
                    _id: 0,
                    userId: 1,
                    username: '$user.username',
                    score: '$score',
                },
            },
        ]);
        const leaderboard = scores.map((item, index) => ({
            rank: skip + index + 1,
            ...item,
        }));
        return {
            leaderboard,
            total,
            page,
            totalPages,
        };
    }
};
exports.ScoreService = ScoreService;
exports.ScoreService = ScoreService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(score_schema_1.Score.name)),
    __param(1, (0, mongoose_1.InjectModel)('Response')),
    __param(2, (0, mongoose_1.InjectModel)(user_schema_1.User.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model])
], ScoreService);
//# sourceMappingURL=score.service.js.map