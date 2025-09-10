import { Model, Types, Document } from 'mongoose';
import { Response } from './response.schema';
import { CreateResponseDto } from './dto/create-response.dto';
import { UpdateResponseDto } from './dto/update-response.dto';
export type ResponseDocument = Response & Document & {
    _id: Types.ObjectId;
};
export declare class ResponseService {
    private readonly responseModel;
    constructor(responseModel: Model<ResponseDocument>);
    create(createResponseDto: CreateResponseDto): Promise<ResponseDocument>;
    createMultiple(createResponseDtos: CreateResponseDto[]): Promise<ResponseDocument[]>;
    findByUserAndQuestion(userId: string, questionId: string): Promise<ResponseDocument | null>;
    findAll(): Promise<ResponseDocument[]>;
    findById(id: string): Promise<ResponseDocument>;
    findByUserId(userId: string): Promise<ResponseDocument[]>;
    deleteByUserId(userId: string): Promise<{
        message: string;
    }>;
    update(id: string, updateDto: UpdateResponseDto): Promise<ResponseDocument>;
    delete(id: string): Promise<{
        message: string;
    }>;
    findAllWithQuestions(): Promise<ResponseDocument[]>;
    findByQuestionId(questionId: string): Promise<ResponseDocument[]>;
}
