"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserModule = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const mongoose_1 = require("@nestjs/mongoose");
const user_service_1 = require("./user.service");
const user_controller_1 = require("./user.controller");
const user_schema_1 = require("./user.schema");
const online_module_1 = require("../gateways/online.module");
const infobip_otp_module_1 = require("../infobip-otp/infobip-otp.module");
const auth_module_1 = require("../auth/auth.module");
const jwt_auth_guard_1 = require("./jwt-auth.guard");
const roles_guard_1 = require("./roles.guard");
let UserModule = class UserModule {
};
exports.UserModule = UserModule;
exports.UserModule = UserModule = __decorate([
    (0, common_1.Module)({
        imports: [
            mongoose_1.MongooseModule.forFeature([{ name: user_schema_1.User.name, schema: user_schema_1.UserSchema }]),
            jwt_1.JwtModule.register({
                secret: '123456',
                signOptions: { expiresIn: '10d' },
            }),
            online_module_1.OnlineModule,
            infobip_otp_module_1.InfobipOtpModule,
            (0, common_1.forwardRef)(() => auth_module_1.AuthModule),
        ],
        providers: [user_service_1.UserService, jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard],
        controllers: [user_controller_1.UserController],
        exports: [user_service_1.UserService, mongoose_1.MongooseModule],
    })
], UserModule);
//# sourceMappingURL=user.module.js.map