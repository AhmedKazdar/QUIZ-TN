import { Schema, Prop, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document } from 'mongoose';

export type UserDocument = User & Document;

@Schema()
export class User {
  @Prop({ type: mongoose.Schema.Types.ObjectId, auto: true }) // Explicitly define _id as ObjectId
  _id: mongoose.Types.ObjectId;

  @Prop({ required: true, unique: true })
  username: string;

  @Prop({ required: true })
  password: string;

  @Prop({ required: false, default: 'user' })
  role: string;

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
