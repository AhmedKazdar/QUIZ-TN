import mongoose, { Document } from 'mongoose';
export type UserDocument = User & Document;
export declare class User {
    _id: mongoose.Types.ObjectId;
    username: string;
    password: string;
    role: string;
    phoneNumber?: string;
    email?: string | null;
    createdAt: Date;
    lastActive: Date;
}
export declare const UserSchema: mongoose.Schema<User, mongoose.Model<User, any, any, any, mongoose.Document<unknown, any, User> & User & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>, {}, {}, {}, {}, mongoose.DefaultSchemaOptions, User, mongoose.Document<unknown, {}, mongoose.FlatRecord<User>> & mongoose.FlatRecord<User> & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}>;
