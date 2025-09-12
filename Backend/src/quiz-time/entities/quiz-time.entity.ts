import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type QuizTimeDocument = QuizTime & Document;

@Schema({ timestamps: true })
export class QuizTime {
  @Prop({ required: true })
  time: string;

  @Prop({ default: true })
  isActive: boolean;
}

export const QuizTimeSchema = SchemaFactory.createForClass(QuizTime);
