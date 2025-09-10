import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { User } from '../user/user.schema'; // Import User schema

export type ScoreDocument = Score & Document;

@Schema()
export class Score {
  @Prop({ required: true, type: Types.ObjectId, ref: 'User' })
  userId: Types.ObjectId;

  @Prop({ required: true, default: 0 })
  score: number; // Store the score as a number

  @Prop({ required: true, default: () => new Date() })
  createdAt: Date;
}

export const ScoreSchema = SchemaFactory.createForClass(Score);
