import { Document, Types } from 'mongoose';
export type ScoreDocument = Score & Document;
export declare class Score {
    userId: Types.ObjectId;
    score: number;
    createdAt: Date;
}
export declare const ScoreSchema: import("mongoose").Schema<Score, import("mongoose").Model<Score, any, any, any, Document<unknown, any, Score> & Score & {
    _id: Types.ObjectId;
} & {
    __v: number;
}, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, Score, Document<unknown, {}, import("mongoose").FlatRecord<Score>> & import("mongoose").FlatRecord<Score> & {
    _id: Types.ObjectId;
} & {
    __v: number;
}>;
