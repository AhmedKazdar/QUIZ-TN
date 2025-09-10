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
exports.QuestionService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const question_schema_1 = require("./question.schema");
const common_2 = require("@nestjs/common");
let QuestionService = class QuestionService {
    questionModel;
    constructor(questionModel) {
        this.questionModel = questionModel;
    }
    async create(createQuestionDto) {
        const newQuestion = new this.questionModel(createQuestionDto);
        return newQuestion.save();
    }
    async findById(id) {
        const question = await this.questionModel.findById(id).exec();
        if (!question) {
            throw new common_1.NotFoundException('Question not found');
        }
        return question;
    }
    async findAll() {
        return this.questionModel.find().exec();
    }
    async findOne(id) {
        return this.questionModel.findById(id).exec();
    }
    async updateQuestion(id, updateQuestionDto) {
        return this.questionModel
            .findByIdAndUpdate(id, updateQuestionDto, { new: true })
            .exec();
    }
    async deleteQuestion(id) {
        const deletedQuestion = await this.questionModel
            .findByIdAndDelete(id)
            .exec();
        if (!deletedQuestion) {
            throw new common_2.UnauthorizedException('Question not found');
        }
        return { message: 'Question deleted successfully' };
    }
};
exports.QuestionService = QuestionService;
exports.QuestionService = QuestionService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(question_schema_1.Question.name)),
    __metadata("design:paramtypes", [mongoose_2.Model])
], QuestionService);
//# sourceMappingURL=question.service.js.map