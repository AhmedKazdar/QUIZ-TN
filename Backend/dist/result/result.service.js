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
exports.ResultService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const result_schema_1 = require("./result.schema");
const response_schema_1 = require("../response/response.schema");
const user_schema_1 = require("../user/user.schema");
const question_schema_1 = require("../question/question.schema");
let ResultService = class ResultService {
    resultModel;
    responseModel;
    userModel;
    questionModel;
    constructor(resultModel, responseModel, userModel, questionModel) {
        this.resultModel = resultModel;
        this.responseModel = responseModel;
        this.userModel = userModel;
        this.questionModel = questionModel;
    }
    async submitAnswer(dto) {
        const results = [];
        for (const answer of dto.answers) {
            const question = await this.questionModel.findById(answer.questionId);
            if (!question)
                throw new common_1.NotFoundException('Question not found');
            const response = await this.responseModel.findById(answer.selectedResponseId);
            if (!response)
                throw new common_1.NotFoundException('Response not found');
            if (!response.questionId.equals(answer.questionId)) {
                throw new common_1.NotFoundException('Response does not belong to the provided question');
            }
            const isCorrect = response.isCorrect;
            const result = new this.resultModel({
                userId: new mongoose_2.Types.ObjectId(dto.userId),
                quizId: new mongoose_2.Types.ObjectId(dto.quizId),
                questionId: new mongoose_2.Types.ObjectId(answer.questionId),
                selectedResponseId: new mongoose_2.Types.ObjectId(answer.selectedResponseId),
                isCorrect,
            });
            await result.save();
            const resultDto = {
                userId: result.userId.toString(),
                questionId: result.questionId.toString(),
                selectedResponseId: result.selectedResponseId.toString(),
                quizId: result.quizId.toString(),
                isCorrect: result.isCorrect,
            };
            results.push(resultDto);
        }
        return results;
    }
    async findAll(page = 1, limit = 10) {
        const results = await this.resultModel
            .find()
            .skip((page - 1) * limit)
            .limit(limit)
            .populate('userId', 'name')
            .populate('questionId', 'questionText')
            .populate('selectedResponseId', 'responseText')
            .populate('quizId', 'quizName')
            .sort({ createdAt: -1 });
        return results.map((result) => ({
            userId: result.userId.toString(),
            questionId: result.questionId.toString(),
            selectedResponseId: result.selectedResponseId.toString(),
            quizId: result.quizId.toString(),
            isCorrect: result.isCorrect,
        }));
    }
};
exports.ResultService = ResultService;
exports.ResultService = ResultService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(result_schema_1.Result.name)),
    __param(1, (0, mongoose_1.InjectModel)(response_schema_1.Response.name)),
    __param(2, (0, mongoose_1.InjectModel)(user_schema_1.User.name)),
    __param(3, (0, mongoose_1.InjectModel)(question_schema_1.Question.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model])
], ResultService);
//# sourceMappingURL=result.service.js.map