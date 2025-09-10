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
exports.ResponseService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const response_schema_1 = require("./response.schema");
let ResponseService = class ResponseService {
    responseModel;
    constructor(responseModel) {
        this.responseModel = responseModel;
    }
    async create(createResponseDto) {
        if (!createResponseDto.userId ||
            !createResponseDto.questionId ||
            typeof createResponseDto.isCorrect !== 'boolean') {
            throw new common_1.BadRequestException('Missing required fields');
        }
        try {
            const response = new this.responseModel({
                userId: new mongoose_2.Types.ObjectId(createResponseDto.userId),
                questionId: new mongoose_2.Types.ObjectId(createResponseDto.questionId),
                isCorrect: createResponseDto.isCorrect,
                text: createResponseDto.text || null,
            });
            const savedResponse = (await response.save());
            console.log('Response saved successfully:', {
                _id: savedResponse._id.toString(),
                userId: savedResponse.userId.toString(),
                questionId: savedResponse.questionId.toString(),
                isCorrect: savedResponse.isCorrect,
                text: savedResponse.text,
            });
            return savedResponse;
        }
        catch (error) {
            if (error.code === 11000) {
                console.log('Duplicate response detected:', {
                    userId: createResponseDto.userId,
                    questionId: createResponseDto.questionId,
                });
                throw new common_1.BadRequestException('Response already exists for this user and question');
            }
            console.error('Error saving response:', error.message);
            throw new common_1.BadRequestException('Failed to save response: ' + error.message);
        }
    }
    async createMultiple(createResponseDtos) {
        const responses = createResponseDtos.map((dto) => ({
            text: dto.text,
            questionId: new mongoose_2.Types.ObjectId(dto.questionId),
            isCorrect: dto.isCorrect,
            userId: new mongoose_2.Types.ObjectId(dto.userId),
        }));
        console.log('Responses to be inserted:', responses);
        try {
            return (await this.responseModel.insertMany(responses, {
                ordered: false,
            }));
        }
        catch (error) {
            if (error.code === 11000) {
                console.log('Duplicate responses detected during bulk insert');
                throw new common_1.BadRequestException('One or more responses already exist');
            }
            console.error('Error inserting multiple responses:', error.message);
            throw new common_1.BadRequestException('Failed to insert responses');
        }
    }
    async findByUserAndQuestion(userId, questionId) {
        try {
            if (!mongoose_2.Types.ObjectId.isValid(userId) ||
                !mongoose_2.Types.ObjectId.isValid(questionId)) {
                console.warn('Invalid ID format:', { userId, questionId });
                throw new common_1.BadRequestException('Invalid userId or questionId format');
            }
            const userObjectId = new mongoose_2.Types.ObjectId(userId);
            const questionObjectId = new mongoose_2.Types.ObjectId(questionId);
            const response = (await this.responseModel
                .findOne({
                userId: userObjectId,
                questionId: questionObjectId,
            })
                .exec());
            console.log('Checked for existing response:', {
                userId: userObjectId.toString(),
                questionId: questionObjectId.toString(),
                found: !!response,
                responseId: response?._id?.toString(),
                responseUserId: response?.userId?.toString(),
                responseQuestionId: response?.questionId?.toString(),
            });
            return response;
        }
        catch (error) {
            console.error('Error checking existing response:', error.message);
            throw new common_1.BadRequestException('Failed to check existing response');
        }
    }
    async findAll() {
        return this.responseModel.find().populate('questionId').exec();
    }
    async findById(id) {
        const response = (await this.responseModel
            .findById(id)
            .populate('questionId'));
        if (!response)
            throw new common_1.NotFoundException('Response not found');
        return response;
    }
    async findByUserId(userId) {
        try {
            if (!mongoose_2.Types.ObjectId.isValid(userId)) {
                throw new common_1.BadRequestException('Invalid userId format');
            }
            const responses = (await this.responseModel
                .find({ userId: new mongoose_2.Types.ObjectId(userId) })
                .exec());
            console.log('Fetched responses for user:', userId, 'count:', responses.length);
            return responses;
        }
        catch (error) {
            console.error('Error fetching responses by userId:', error.message);
            throw new common_1.BadRequestException('Failed to fetch responses');
        }
    }
    async deleteByUserId(userId) {
        try {
            if (!mongoose_2.Types.ObjectId.isValid(userId)) {
                throw new common_1.BadRequestException('Invalid userId format');
            }
            const userObjectId = new mongoose_2.Types.ObjectId(userId);
            const result = await this.responseModel
                .deleteMany({ userId: userObjectId })
                .exec();
            console.log(`Deleted ${result.deletedCount} responses for user: ${userId}`);
            return {
                message: `Deleted ${result.deletedCount} responses successfully`,
            };
        }
        catch (error) {
            console.error('Error deleting responses for user:', error.message);
            throw new common_1.InternalServerErrorException('Failed to delete responses');
        }
    }
    async update(id, updateDto) {
        const updated = (await this.responseModel
            .findByIdAndUpdate(id, updateDto, {
            new: true,
            runValidators: true,
        })
            .populate('questionId'));
        if (!updated)
            throw new common_1.NotFoundException('Response not found');
        return updated;
    }
    async delete(id) {
        const deleted = (await this.responseModel.findByIdAndDelete(id));
        if (!deleted)
            throw new common_1.NotFoundException('Response not found');
        return { message: 'Response deleted successfully' };
    }
    async findAllWithQuestions() {
        return this.responseModel.find().populate('questionId').exec();
    }
    async findByQuestionId(questionId) {
        console.log('Searching for responses with questionId:', questionId);
        const responses = (await this.responseModel
            .find({ questionId: new mongoose_2.Types.ObjectId(questionId) })
            .populate('questionId')
            .exec());
        console.log('Found responses:', responses);
        return responses;
    }
};
exports.ResponseService = ResponseService;
exports.ResponseService = ResponseService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(response_schema_1.Response.name)),
    __metadata("design:paramtypes", [mongoose_2.Model])
], ResponseService);
//# sourceMappingURL=response.service.js.map