"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateScoreDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const create_score_dto_1 = require("./create-score.dto");
class UpdateScoreDto extends (0, swagger_1.PartialType)(create_score_dto_1.CreateScoreDto) {
}
exports.UpdateScoreDto = UpdateScoreDto;
//# sourceMappingURL=update-score.dto.js.map