import { QuestionService } from './question.service';
import { CreateQuestionDto } from './dto/create-question.dto';
import { ResponseService } from '../response/response.service';
export declare class QuestionController {
    private readonly questionService;
    private readonly responseService;
    constructor(questionService: QuestionService, responseService: ResponseService);
    create(createQuestionDto: CreateQuestionDto): Promise<{
        message: string;
        question: import("./question.schema").Question;
    } | {
        message: any;
        question?: undefined;
    }>;
    findAll(): Promise<{
        message: string;
        questions: import("./question.schema").Question[];
    } | {
        message: any;
        questions?: undefined;
    }>;
    findOne(id: string): Promise<{
        question: import("./question.schema").Question;
        responses: import("../response/response.service").ResponseDocument[];
        message?: undefined;
    } | {
        message: any;
        question?: undefined;
        responses?: undefined;
    }>;
    updateQuestion(id: string, updateQuestionDto: CreateQuestionDto): Promise<{
        message: string;
        updatedQuestion: import("./question.schema").Question;
    } | {
        message: any;
        updatedQuestion?: undefined;
    }>;
    deleteQuestion(id: string): Promise<{
        message: any;
    }>;
}
