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
exports.QuestionController = void 0;
const common_1 = require("@nestjs/common");
const question_service_1 = require("./question.service");
const create_question_dto_1 = require("./dto/create-question.dto");
const response_service_1 = require("../response/response.service");
const swagger_1 = require("@nestjs/swagger");
let QuestionController = class QuestionController {
    questionService;
    responseService;
    constructor(questionService, responseService) {
        this.questionService = questionService;
        this.responseService = responseService;
    }
    async create(createQuestionDto) {
        try {
            const question = await this.questionService.create(createQuestionDto);
            return { message: 'Question created successfully by admin', question };
        }
        catch (error) {
            return { message: error.message };
        }
    }
    async findAll() {
        try {
            const questions = await this.questionService.findAll();
            return { message: 'Questions extracted successfully', questions };
        }
        catch (error) {
            return { message: error.message };
        }
    }
    async findOne(id) {
        try {
            const question = await this.questionService.findOne(id);
            if (!question) {
                throw new common_1.NotFoundException('Question not found');
            }
            const responses = await this.responseService.findByQuestionId(id);
            return { question, responses };
        }
        catch (error) {
            return { message: error.message };
        }
    }
    async updateQuestion(id, updateQuestionDto) {
        try {
            const updatedQuestion = await this.questionService.updateQuestion(id, updateQuestionDto);
            if (!updatedQuestion) {
                throw new common_1.NotFoundException('Question not found');
            }
            return { message: 'Question updated successfully', updatedQuestion };
        }
        catch (error) {
            return { message: error.message };
        }
    }
    async deleteQuestion(id) {
        try {
            const response = await this.questionService.deleteQuestion(id);
            return { message: response.message };
        }
        catch (error) {
            return { message: error.message };
        }
    }
};
exports.QuestionController = QuestionController;
__decorate([
    (0, common_1.Post)('create'),
    (0, swagger_1.ApiOperation)({ summary: 'Creates a new question' }),
    (0, swagger_1.ApiCreatedResponse)({ description: 'Question created successfully' }),
    (0, swagger_1.ApiBadRequestResponse)({ description: 'Invalid data provided' }),
    (0, common_1.UsePipes)(new common_1.ValidationPipe()),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_question_dto_1.CreateQuestionDto]),
    __metadata("design:returntype", Promise)
], QuestionController.prototype, "create", null);
__decorate([
    (0, common_1.Get)('all'),
    (0, swagger_1.ApiOperation)({ summary: 'Fetch a list of questions ' }),
    (0, swagger_1.ApiOkResponse)({
        description: 'List of questions fetched sucessfully.',
    }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], QuestionController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, swagger_1.ApiOperation)({ summary: 'Fetch a question by id' }),
    (0, swagger_1.ApiOkResponse)({ description: 'Question found' }),
    (0, swagger_1.ApiNotFoundResponse)({ description: 'Question not found.' }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], QuestionController.prototype, "findOne", null);
__decorate([
    (0, common_1.Put)('update/:id'),
    (0, common_1.UsePipes)(new common_1.ValidationPipe()),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, create_question_dto_1.CreateQuestionDto]),
    __metadata("design:returntype", Promise)
], QuestionController.prototype, "updateQuestion", null);
__decorate([
    (0, common_1.Delete)('delete/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], QuestionController.prototype, "deleteQuestion", null);
exports.QuestionController = QuestionController = __decorate([
    (0, swagger_1.ApiTags)('question'),
    (0, common_1.Controller)('question'),
    __param(1, (0, common_1.Inject)((0, common_1.forwardRef)(() => response_service_1.ResponseService))),
    __metadata("design:paramtypes", [question_service_1.QuestionService,
        response_service_1.ResponseService])
], QuestionController);
//# sourceMappingURL=question.controller.js.map