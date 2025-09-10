import { Model } from 'mongoose';
import { ResultDocument } from './result.schema';
import { ResultDto } from './dto/result.dto';
import { SubmitAnswerDto } from './dto/submit-answer.dto';
import { ResponseDocument } from '../response/response.schema';
import { UserDocument } from '../user/user.schema';
import { QuestionDocument } from '../question/question.schema';
export declare class ResultService {
    private resultModel;
    private responseModel;
    private userModel;
    private questionModel;
    constructor(resultModel: Model<ResultDocument>, responseModel: Model<ResponseDocument>, userModel: Model<UserDocument>, questionModel: Model<QuestionDocument>);
    submitAnswer(dto: SubmitAnswerDto): Promise<ResultDto[]>;
    findAll(page?: number, limit?: number): Promise<ResultDto[]>;
}
