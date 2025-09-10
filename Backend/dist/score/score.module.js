"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScoreModule = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const score_service_1 = require("./score.service");
const score_controller_1 = require("./score.controller");
const score_schema_1 = require("./score.schema");
const user_schema_1 = require("../user/user.schema");
const response_schema_1 = require("../response/response.schema");
const question_schema_1 = require("../question/question.schema");
const user_module_1 = require("../user/user.module");
const response_module_1 = require("../response/response.module");
const question_module_1 = require("../question/question.module");
let ScoreModule = class ScoreModule {
};
exports.ScoreModule = ScoreModule;
exports.ScoreModule = ScoreModule = __decorate([
    (0, common_1.Module)({
        imports: [
            mongoose_1.MongooseModule.forFeature([
                { name: score_schema_1.Score.name, schema: score_schema_1.ScoreSchema },
                { name: user_schema_1.User.name, schema: user_schema_1.UserSchema },
                { name: response_schema_1.Response.name, schema: response_schema_1.ResponseSchema },
                { name: question_schema_1.Question.name, schema: question_schema_1.QuestionSchema },
            ]),
            user_module_1.UserModule,
            (0, common_1.forwardRef)(() => response_module_1.ResponseModule),
            (0, common_1.forwardRef)(() => question_module_1.QuestionModule),
        ],
        providers: [score_service_1.ScoreService],
        controllers: [score_controller_1.ScoreController],
        exports: [score_service_1.ScoreService],
    })
], ScoreModule);
//# sourceMappingURL=score.module.js.map