// src/question/question.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type QuestionDocument = Question & Document;

@Schema()
export class Question {
  @Prop({ required: true })
  textequestion: string;

  @Prop({ required: true })
  type: string;
}

export const QuestionSchema = SchemaFactory.createForClass(Question);
