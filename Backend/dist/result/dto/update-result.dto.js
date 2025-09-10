"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateResultDto = void 0;
const mapped_types_1 = require("@nestjs/mapped-types");
const submit_answer_dto_1 = require("./submit-answer.dto");
class UpdateResultDto extends (0, mapped_types_1.PartialType)(submit_answer_dto_1.SubmitAnswerDto) {
}
exports.UpdateResultDto = UpdateResultDto;
//# sourceMappingURL=update-result.dto.js.map