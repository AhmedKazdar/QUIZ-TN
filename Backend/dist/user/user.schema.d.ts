import mongoose, { Document } from 'mongoose';
export declare enum UserRole {
    USER = "user",
    ADMIN = "admin"
}
export type UserDocument = User & Document;
export declare class User {
    _id: mongoose.Types.ObjectId;
    username: string;
    password: string;
    role: UserRole;
    phoneNumber?: string;
    email?: string | null;
    createdAt: Date;
    lastActive: Date;
}
export declare const UserSchema: mongoose.Schema<User, mongoose.Model<User, any, any, any, mongoose.Document<unknown, any, User, any, {}> & User & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>, {}, {}, {}, {}, mongoose.DefaultSchemaOptions, User, mongoose.Document<unknown, {}, mongoose.FlatRecord<User>, {}, mongoose.ResolveSchemaOptions<mongoose.DefaultSchemaOptions>> & mongoose.FlatRecord<User> & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}>;
