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
exports.ResponseController = void 0;
const common_1 = require("@nestjs/common");
const response_service_1 = require("./response.service");
const user_service_1 = require("../user/user.service");
const question_service_1 = require("../question/question.service");
const score_service_1 = require("../score/score.service");
const create_response_dto_1 = require("./dto/create-response.dto");
const update_response_dto_1 = require("./dto/update-response.dto");
const swagger_1 = require("@nestjs/swagger");
const mongoose_1 = require("mongoose");
let ResponseController = class ResponseController {
    responseService;
    userService;
    questionService;
    scoreService;
    constructor(responseService, userService, questionService, scoreService) {
        this.responseService = responseService;
        this.userService = userService;
        this.questionService = questionService;
        this.scoreService = scoreService;
    }
    async submitResponses(responses) {
        if (!responses || !Array.isArray(responses) || responses.length === 0) {
            throw new common_1.BadRequestException('Invalid or empty responses array');
        }
        const results = [];
        let totalScore = 0;
        const userId = responses[0]?.userId;
        if (!userId || !mongoose_1.Types.ObjectId.isValid(userId)) {
            throw new common_1.BadRequestException('Invalid or missing userId');
        }
        console.log('Submitting responses for userId:', userId);
        const user = await this.userService.findById(userId);
        if (!user) {
            throw new common_1.NotFoundException(`User ${userId} not found`);
        }
        for (const responseData of responses) {
            const { userId: responseUserId, questionId, isCorrect, text, selectedAnswerText, } = responseData;
            console.log('Processing response data:', responseData);
            if (!responseUserId ||
                !questionId ||
                typeof isCorrect !== 'boolean' ||
                !(text || selectedAnswerText) ||
                responseUserId !== userId) {
                console.warn('Invalid response data, skipping:', {
                    responseUserId,
                    questionId,
                    isCorrect,
                    text,
                    selectedAnswerText,
                    userIdMatch: responseUserId === userId,
                });
                continue;
            }
            if (!mongoose_1.Types.ObjectId.isValid(questionId)) {
                console.warn('Invalid questionId format, skipping:', questionId);
                continue;
            }
            try {
                console.log('Fetching question with ID:', questionId);
                const question = await this.questionService.findById(questionId);
                if (!question) {
                    console.warn('Question not found for ID:', questionId);
                    continue;
                }
                console.log('Checking for existing response for user:', userId, 'question:', questionId);
                const existingResponse = (await this.responseService.findByUserAndQuestion(userId, questionId));
                let newResponse;
                if (existingResponse) {
                    console.log('Updating existing response for user:', userId, 'question:', questionId, 'responseId:', existingResponse._id.toString(), 'old isCorrect:', existingResponse.isCorrect, 'new isCorrect:', isCorrect);
                    newResponse = (await this.responseService.update(existingResponse._id.toString(), {
                        userId,
                        questionId,
                        isCorrect,
                        text: text || selectedAnswerText,
                    }));
                }
                else {
                    newResponse = (await this.responseService.create({
                        userId,
                        questionId,
                        isCorrect,
                        text: text || selectedAnswerText,
                    }));
                    console.log('New Response Saved:', {
                        _id: newResponse._id.toString(),
                        userId: newResponse.userId.toString(),
                        questionId: newResponse.questionId.toString(),
                        isCorrect: newResponse.isCorrect,
                        text: newResponse.text,
                    });
                }
                results.push(newResponse);
                if (newResponse.isCorrect) {
                    totalScore += 1;
                }
            }
            catch (error) {
                console.error('Error processing response for question:', questionId, error.message);
                const errorResponse = {
                    _id: new mongoose_1.Types.ObjectId(),
                    userId: new mongoose_1.Types.ObjectId(userId),
                    questionId: new mongoose_1.Types.ObjectId(questionId),
                    isCorrect,
                    text: `Error: ${error.message}`,
                };
                results.push(errorResponse);
            }
        }
        console.log('Final Score:', totalScore);
        try {
            const updatedScore = await this.scoreService.syncUserScore(userId);
            console.log('Updated Score in DB:', updatedScore);
        }
        catch (error) {
            console.error('Error syncing score:', error.message);
        }
        return {
            message: 'Responses submitted successfully',
            responses: results,
            score: totalScore,
        };
    }
    async findAll(userId) {
        try {
            if (userId) {
                if (!mongoose_1.Types.ObjectId.isValid(userId)) {
                    throw new common_1.BadRequestException('Invalid userId format');
                }
                const responses = await this.responseService.findByUserId(userId);
                return { message: 'Fetched user responses', responses };
            }
            const responses = await this.responseService.findAllWithQuestions();
            return { message: 'Fetched all responses', responses };
        }
        catch (error) {
            return { message: error.message };
        }
    }
    async findByQuestionId(questionId) {
        try {
            const responses = await this.responseService.findByQuestionId(questionId);
            if (responses.length === 0) {
                return { message: 'No responses found for this question' };
            }
            return { message: 'Fetched responses for question', responses };
        }
        catch (error) {
            return { message: error.message };
        }
    }
    async create(createResponseDto) {
        const { questionId } = createResponseDto;
        if (!mongoose_1.Types.ObjectId.isValid(questionId)) {
            throw new common_1.BadRequestException('Invalid questionId format');
        }
        try {
            const response = await this.responseService.create(createResponseDto);
            return { message: 'Response created successfully', response };
        }
        catch (error) {
            throw new common_1.BadRequestException('Failed to create response');
        }
    }
    async createMultiple(createResponseDtos) {
        try {
            const responses = await this.responseService.createMultiple(createResponseDtos);
            return { message: 'Responses created successfully', responses };
        }
        catch (error) {
            return { message: error.message };
        }
    }
    ping() {
        return 'pong';
    }
    async update(id, updateResponseDto) {
        try {
            const updatedResponse = await this.responseService.update(id, updateResponseDto);
            return { message: 'Response updated successfully', updatedResponse };
        }
        catch (error) {
            return { message: error.message };
        }
    }
    async deleteByUserId(userId) {
        try {
            return await this.responseService.deleteByUserId(userId);
        }
        catch (error) {
            throw new common_1.BadRequestException(error.message);
        }
    }
    async delete(id) {
        try {
            const deleteResult = await this.responseService.delete(id);
            return { message: deleteResult.message };
        }
        catch (error) {
            return { message: error.message };
        }
    }
};
exports.ResponseController = ResponseController;
__decorate([
    (0, common_1.Post)('submit'),
    (0, swagger_1.ApiOperation)({
        summary: 'Submit multiple responses (userId, questionId, isCorrect)',
    }),
    (0, swagger_1.ApiCreatedResponse)({ description: 'Responses submitted successfully' }),
    (0, swagger_1.ApiBadRequestResponse)({ description: 'Invalid data provided' }),
    (0, swagger_1.ApiNotFoundResponse)({ description: 'User or Question not found' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Array]),
    __metadata("design:returntype", Promise)
], ResponseController.prototype, "submitResponses", null);
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({ summary: 'Fetch a list of responses' }),
    (0, swagger_1.ApiOkResponse)({ description: 'List of responses fetched successfully' }),
    __param(0, (0, common_1.Query)('userId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ResponseController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)('question/:questionId'),
    (0, swagger_1.ApiOperation)({ summary: 'Fetch responses by questionId' }),
    (0, swagger_1.ApiOkResponse)({ description: 'Responses found' }),
    (0, swagger_1.ApiNotFoundResponse)({ description: 'No responses found for the question' }),
    __param(0, (0, common_1.Param)('questionId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ResponseController.prototype, "findByQuestionId", null);
__decorate([
    (0, common_1.Post)('create'),
    (0, swagger_1.ApiOperation)({ summary: 'Creates a new response' }),
    (0, swagger_1.ApiCreatedResponse)({ description: 'Response created successfully' }),
    (0, swagger_1.ApiBadRequestResponse)({ description: 'Invalid data provided' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_response_dto_1.CreateResponseDto]),
    __metadata("design:returntype", Promise)
], ResponseController.prototype, "create", null);
__decorate([
    (0, common_1.Post)('create-multiple'),
    (0, swagger_1.ApiOperation)({ summary: 'Creates multiple responses' }),
    (0, swagger_1.ApiCreatedResponse)({ description: 'Responses created successfully' }),
    (0, swagger_1.ApiBadRequestResponse)({ description: 'Invalid data provided' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Array]),
    __metadata("design:returntype", Promise)
], ResponseController.prototype, "createMultiple", null);
__decorate([
    (0, common_1.Get)('ping'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], ResponseController.prototype, "ping", null);
__decorate([
    (0, common_1.Put)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_response_dto_1.UpdateResponseDto]),
    __metadata("design:returntype", Promise)
], ResponseController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)('user/:userId'),
    (0, swagger_1.ApiOperation)({ summary: 'Delete all responses for a user' }),
    (0, swagger_1.ApiOkResponse)({ description: 'Responses deleted successfully' }),
    (0, swagger_1.ApiBadRequestResponse)({ description: 'Invalid userId format' }),
    __param(0, (0, common_1.Param)('userId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ResponseController.prototype, "deleteByUserId", null);
__decorate([
    (0, common_1.Delete)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ResponseController.prototype, "delete", null);
exports.ResponseController = ResponseController = __decorate([
    (0, swagger_1.ApiTags)('response'),
    (0, common_1.Controller)('response'),
    __metadata("design:paramtypes", [response_service_1.ResponseService,
        user_service_1.UserService,
        question_service_1.QuestionService,
        score_service_1.ScoreService])
], ResponseController);
//# sourceMappingURL=response.controller.js.map