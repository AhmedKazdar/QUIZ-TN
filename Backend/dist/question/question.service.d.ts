import { Model } from 'mongoose';
import { Question, QuestionDocument } from './question.schema';
import { CreateQuestionDto } from './dto/create-question.dto';
export declare class QuestionService {
    private questionModel;
    constructor(questionModel: Model<QuestionDocument>);
    create(createQuestionDto: CreateQuestionDto): Promise<Question>;
    findById(id: string): Promise<Question>;
    findAll(): Promise<Question[]>;
    findOne(id: string): Promise<Question | null>;
    updateQuestion(id: string, updateQuestionDto: CreateQuestionDto): Promise<Question | null>;
    deleteQuestion(id: string): Promise<{
        message: string;
    }>;
}
