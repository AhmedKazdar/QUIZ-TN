import { Document } from 'mongoose';
export type QuestionDocument = Question & Document;
export declare class Question {
    textequestion: string;
    type: string;
}
export declare const QuestionSchema: import("mongoose").Schema<Question, import("mongoose").Model<Question, any, any, any, Document<unknown, any, Question, any, {}> & Question & {
    _id: import("mongoose").Types.ObjectId;
} & {
    __v: number;
}, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, Question, Document<unknown, {}, import("mongoose").FlatRecord<Question>, {}, import("mongoose").ResolveSchemaOptions<import("mongoose").DefaultSchemaOptions>> & import("mongoose").FlatRecord<Question> & {
    _id: import("mongoose").Types.ObjectId;
} & {
    __v: number;
}>;
