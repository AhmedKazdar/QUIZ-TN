import { Document, Types } from 'mongoose';
export type ResponseDocument = Response & Document;
export declare class Response {
    text: string;
    questionId: Types.ObjectId;
    isCorrect: boolean;
    userId: Types.ObjectId;
}
export declare const ResponseSchema: import("mongoose").Schema<Response, import("mongoose").Model<Response, any, any, any, Document<unknown, any, Response, any, {}> & Response & {
    _id: Types.ObjectId;
} & {
    __v: number;
}, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, Response, Document<unknown, {}, import("mongoose").FlatRecord<Response>, {}, import("mongoose").ResolveSchemaOptions<import("mongoose").DefaultSchemaOptions>> & import("mongoose").FlatRecord<Response> & {
    _id: Types.ObjectId;
} & {
    __v: number;
}>;
