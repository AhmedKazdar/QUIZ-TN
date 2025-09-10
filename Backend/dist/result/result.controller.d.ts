import { ResultService } from './result.service';
import { SubmitAnswerDto } from './dto/submit-answer.dto';
import { ResultDto } from './dto/result.dto';
export declare class ResultController {
    private readonly resultService;
    constructor(resultService: ResultService);
    submitAnswer(submitAnswerDto: SubmitAnswerDto): Promise<ResultDto[]>;
    findAll(page?: string, limit?: string): Promise<ResultDto[]>;
}
