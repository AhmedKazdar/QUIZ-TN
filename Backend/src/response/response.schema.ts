import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { Question } from '../question/question.schema'; // Import Question schema

export type ResponseDocument = Response & Document;

@Schema()
export class Response {
  @Prop({ required: false })
  text: string;

  @Prop({ required: true, type: Types.ObjectId, ref: 'Question' })
  questionId: Types.ObjectId;

  @Prop({ required: true })
  isCorrect: boolean;

  @Prop({ required: true, type: Types.ObjectId, ref: 'User' })
  userId: Types.ObjectId;
}

export const ResponseSchema = SchemaFactory.createForClass(Response);
