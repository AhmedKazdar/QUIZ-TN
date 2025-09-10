import { Types } from 'mongoose';
export declare class CreateResponseDto {
    text: string;
    questionId: Types.ObjectId;
    isCorrect: boolean;
    userId: Types.ObjectId;
}
