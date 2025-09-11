import { Document, Types } from 'mongoose';
export type ResultDocument = Result & Document;
export declare class Result {
    userId: Types.ObjectId;
    questionId: Types.ObjectId;
    selectedResponseId: Types.ObjectId;
    quizId: Types.ObjectId;
    isCorrect: boolean;
}
export declare const ResultSchema: import("mongoose").Schema<Result, import("mongoose").Model<Result, any, any, any, Document<unknown, any, Result, any, {}> & Result & {
    _id: Types.ObjectId;
} & {
    __v: number;
}, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, Result, Document<unknown, {}, import("mongoose").FlatRecord<Result>, {}, import("mongoose").ResolveSchemaOptions<import("mongoose").DefaultSchemaOptions>> & import("mongoose").FlatRecord<Result> & {
    _id: Types.ObjectId;
} & {
    __v: number;
}>;
