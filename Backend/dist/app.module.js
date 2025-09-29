"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const mongoose_1 = require("@nestjs/mongoose");
const user_module_1 = require("./user/user.module");
const auth_module_1 = require("./auth/auth.module");
const question_module_1 = require("./question/question.module");
const response_module_1 = require("./response/response.module");
const result_module_1 = require("./result/result.module");
const score_module_1 = require("./score/score.module");
const online_module_1 = require("./gateways/online.module");
const infobip_otp_module_1 = require("./infobip-otp/infobip-otp.module");
const webhook_module_1 = require("./webhook/webhook.module");
const health_controller_1 = require("./health/health.controller");
const quiz_time_module_1 = require("./quiz-time/quiz-time.module");
const player_module_1 = require("./player/player.module");
const quiz_module_1 = require("./quiz/quiz.module");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        controllers: [health_controller_1.HealthController],
        imports: [
            config_1.ConfigModule.forRoot({
                isGlobal: true,
                envFilePath: '.env',
            }),
            mongoose_1.MongooseModule.forRootAsync({
                imports: [config_1.ConfigModule],
                useFactory: (configService) => ({
                    uri: configService.get('MONGODB_URI')
                }),
                inject: [config_1.ConfigService],
            }),
            user_module_1.UserModule,
            auth_module_1.AuthModule,
            question_module_1.QuestionModule,
            response_module_1.ResponseModule,
            result_module_1.ResultModule,
            score_module_1.ScoreModule,
            online_module_1.OnlineModule,
            infobip_otp_module_1.InfobipOtpModule,
            webhook_module_1.WebhookModule,
            quiz_time_module_1.QuizTimeModule,
            player_module_1.PlayerModule,
            quiz_module_1.QuizModule,
        ],
        providers: [],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map