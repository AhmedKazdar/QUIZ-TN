import { ResponseService } from './response.service';
import { UserService } from '../user/user.service';
import { QuestionService } from '../question/question.service';
import { ScoreService } from '../score/score.service';
import { CreateResponseDto } from './dto/create-response.dto';
import { UpdateResponseDto } from './dto/update-response.dto';
import { Types, Document } from 'mongoose';
export type ResponseDocument = Document & {
    _id: Types.ObjectId;
    userId: Types.ObjectId;
    questionId: Types.ObjectId;
    isCorrect: boolean;
    text: string;
};
export declare class ResponseController {
    private readonly responseService;
    private readonly userService;
    private readonly questionService;
    private readonly scoreService;
    constructor(responseService: ResponseService, userService: UserService, questionService: QuestionService, scoreService: ScoreService);
    submitResponses(responses: any[]): Promise<{
        message: string;
        responses: ResponseDocument[];
        score: number;
    }>;
    findAll(userId?: string): Promise<{
        message: string;
        responses: import("./response.service").ResponseDocument[];
    } | {
        message: any;
        responses?: undefined;
    }>;
    findByQuestionId(questionId: string): Promise<{
        message: string;
        responses: import("./response.service").ResponseDocument[];
    } | {
        message: any;
        responses?: undefined;
    }>;
    create(createResponseDto: CreateResponseDto): Promise<{
        message: string;
        response: import("./response.service").ResponseDocument;
    }>;
    createMultiple(createResponseDtos: CreateResponseDto[]): Promise<{
        message: string;
        responses: import("./response.service").ResponseDocument[];
    } | {
        message: any;
        responses?: undefined;
    }>;
    ping(): string;
    update(id: string, updateResponseDto: UpdateResponseDto): Promise<{
        message: string;
        updatedResponse: import("./response.service").ResponseDocument;
    } | {
        message: any;
        updatedResponse?: undefined;
    }>;
    deleteByUserId(userId: string): Promise<{
        message: string;
    }>;
    delete(id: string): Promise<{
        message: any;
    }>;
}
