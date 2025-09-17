import { Schema, Prop, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document } from 'mongoose';

export enum UserRole {
  USER = 'user',
  ADMIN = 'admin'
}

export type UserDocument = User & Document;

@Schema()
export class User {
  @Prop({ type: mongoose.Schema.Types.ObjectId, auto: true }) // Explicitly define _id as ObjectId
  _id: mongoose.Types.ObjectId;

  @Prop({ required: true, unique: true })
  username: string;

  @Prop({ required: true })
  password: string;

  @Prop({ 
    type: String, 
    enum: Object.values(UserRole),
    default: UserRole.USER 
  })
  role: UserRole;

  @Prop({ required: false })
  phoneNumber?: string;

  @Prop({ 
    type: String,
    required: false, 
    index: { unique: true, sparse: true },
    default: null
  })
  email?: string | null;

  @Prop({ default: () => new Date() }) // automatically set creation date
  createdAt: Date;

  @Prop({ type: Date })
  lastActive: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);
