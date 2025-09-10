// src/question/question.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Question, QuestionDocument } from './question.schema';
import { CreateQuestionDto } from './dto/create-question.dto';
import { UnauthorizedException } from '@nestjs/common';

@Injectable()
export class QuestionService {
  constructor(
    @InjectModel(Question.name) private questionModel: Model<QuestionDocument>,
  ) {}

  async create(createQuestionDto: CreateQuestionDto): Promise<Question> {
    const newQuestion = new this.questionModel(createQuestionDto);
    return newQuestion.save();
  }
  async findById(id: string): Promise<Question> {
    const question = await this.questionModel.findById(id).exec();
    if (!question) {
      throw new NotFoundException('Question not found');
    }
    return question;
  }
  async findAll(): Promise<Question[]> {
    return this.questionModel.find().exec();
  }

  async findOne(id: string): Promise<Question | null> {
    return this.questionModel.findById(id).exec();
  }

  async updateQuestion(
    id: string,
    updateQuestionDto: CreateQuestionDto,
  ): Promise<Question | null> {
    return this.questionModel
      .findByIdAndUpdate(id, updateQuestionDto, { new: true })
      .exec();
  }

  // Delete question by ID
  async deleteQuestion(id: string): Promise<{ message: string }> {
    const deletedQuestion = await this.questionModel
      .findByIdAndDelete(id)
      .exec();

    if (!deletedQuestion) {
      throw new UnauthorizedException('Question not found');
    }

    return { message: 'Question deleted successfully' };
  }
}
