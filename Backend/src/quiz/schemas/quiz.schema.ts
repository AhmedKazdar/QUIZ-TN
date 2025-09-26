import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type QuizDocument = Quiz & Document;

export class AnswerOption {
  @Prop({ required: true })
  text: string;

  @Prop({ default: false })
  isCorrect: boolean;
}

@Schema({ timestamps: true })
export class Quiz {
  @Prop({ required: true })
  question: string;

  @Prop({ type: [AnswerOption], required: true })
  options: AnswerOption[];

  @Prop({ type: Types.ObjectId, ref: 'User', required: false })
  createdBy?: Types.ObjectId;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'Response' }] })
  responses?: Types.ObjectId[];

  @Prop({ default: 0 })
  timesAnswered: number;

  @Prop({ default: 0 })
  timesAnsweredCorrectly: number;

  @Prop({ default: 0 })
  averageTimeSpent: number; // in seconds
}

export const QuizSchema = SchemaFactory.createForClass(Quiz);

// Add indexes for better query performance
QuizSchema.index({ timesAnswered: -1 });
QuizSchema.index({ 'options.isCorrect': 1 });
