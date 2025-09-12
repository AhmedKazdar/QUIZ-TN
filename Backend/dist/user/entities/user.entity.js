"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.User = exports.UserRole = void 0;
var UserRole;
(function (UserRole) {
    UserRole["USER"] = "user";
    UserRole["ADMIN"] = "admin";
})(UserRole || (exports.UserRole = UserRole = {}));
class User {
    id;
    username;
    email;
    password;
    role;
    isActive;
    createdAt;
    updatedAt;
}
exports.User = User;
//# sourceMappingURL=user.entity.js.map