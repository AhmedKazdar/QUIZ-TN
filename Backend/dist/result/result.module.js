"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResultModule = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const result_schema_1 = require("./result.schema");
const result_service_1 = require("./result.service");
const result_controller_1 = require("./result.controller");
const response_module_1 = require("../response/response.module");
const user_schema_1 = require("../user/user.schema");
const question_schema_1 = require("../question/question.schema");
const response_schema_1 = require("../response/response.schema");
let ResultModule = class ResultModule {
};
exports.ResultModule = ResultModule;
exports.ResultModule = ResultModule = __decorate([
    (0, common_1.Module)({
        imports: [
            mongoose_1.MongooseModule.forFeature([
                { name: result_schema_1.Result.name, schema: result_schema_1.ResultSchema },
                { name: user_schema_1.User.name, schema: user_schema_1.UserSchema },
                { name: question_schema_1.Question.name, schema: question_schema_1.QuestionSchema },
                { name: response_schema_1.Response.name, schema: response_schema_1.ResponseSchema },
            ]),
            response_module_1.ResponseModule,
        ],
        controllers: [result_controller_1.ResultController],
        providers: [result_service_1.ResultService],
    })
], ResultModule);
//# sourceMappingURL=result.module.js.map