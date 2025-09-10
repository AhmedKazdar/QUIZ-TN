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
exports.ResultSchema = exports.Result = void 0;
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
let Result = class Result {
    userId;
    questionId;
    selectedResponseId;
    quizId;
    isCorrect;
};
exports.Result = Result;
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Types.ObjectId, ref: 'User', required: true }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], Result.prototype, "userId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Types.ObjectId, ref: 'Question', required: true }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], Result.prototype, "questionId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Types.ObjectId, ref: 'Response', required: true }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], Result.prototype, "selectedResponseId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Types.ObjectId, ref: 'Quiz', required: true }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], Result.prototype, "quizId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: false }),
    __metadata("design:type", Boolean)
], Result.prototype, "isCorrect", void 0);
exports.Result = Result = __decorate([
    (0, mongoose_1.Schema)({ timestamps: true })
], Result);
exports.ResultSchema = mongoose_1.SchemaFactory.createForClass(Result);
//# sourceMappingURL=result.schema.js.map