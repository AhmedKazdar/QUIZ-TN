import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Quiz, QuizDocument } from './schemas/quiz.schema';
import { CreateQuizDto, SubmitQuizResponseDto } from './dto/create-quiz.dto';

export interface QuizQuestion {
  id: string;
  question: string;
  options: { id: string; text: string; isCorrect: boolean }[];
  category?: string;
  difficulty?: string;
}

@Injectable()
export class QuizService {
  constructor(
    @InjectModel(Quiz.name) private quizModel: Model<QuizDocument>,
  ) {}

  async create(createQuizDto: CreateQuizDto): Promise<Quiz> {
    const createdQuiz = new this.quizModel({
      ...createQuizDto,
      timesAnswered: 0,
      timesAnsweredCorrectly: 0,
      averageTimeSpent: 0,
    });
    return createdQuiz.save();
  }

  async findById(id: string): Promise<Quiz> {
    const quiz = await this.quizModel.findById(id).exec();
    if (!quiz) {
      throw new NotFoundException('Quiz question not found');
    }
    return quiz;
  }

  /**
   * Get a specified number of random questions from the database
   */
  async getRandomQuestions(count: number): Promise<any[]> {
    try {
      console.log(`🎯 [QUIZ SERVICE] Getting ${count} random questions`);
      
      // Use quizModel instead of questionModel
      const questions = await this.quizModel.aggregate([
        { $sample: { size: count } }
      ]).exec();
  
      console.log(`✅ [QUIZ SERVICE] Retrieved ${questions.length} questions from database`);
      
      // Log first question for debugging
      if (questions.length > 0) {
        console.log(`📋 [QUIZ SERVICE] First question details:`, {
          id: questions[0]._id?.toString(),
          question: questions[0].question,
          optionsCount: questions[0].options?.length,
          options: questions[0].options?.map(opt => ({
            text: opt.text?.substring(0, 20) + '...',
            isCorrect: opt.isCorrect
          }))
        });
      }
      
      return questions;
    } catch (error) {
      console.error(`❌ [QUIZ SERVICE] Error getting random questions:`, error);
      throw error;
    }
  }
  

  async getAllQuestions(): Promise<QuizQuestion[]> {
    try {
      const questions = await this.quizModel.find().lean().exec();
      return questions.map((q: any) => ({
        _id: q._id.toString(),
        id: q._id.toString(),
        question: q.question,
        options: Array.isArray(q.options)
          ? q.options.map((opt, idx) => ({
              id: idx.toString(),
              text: opt.text,
              isCorrect: opt.isCorrect,
            }))
          : [],
        category: q.category || 'General',
        difficulty: q.difficulty || 'Medium',
      }));
    } catch (error) {
      console.error('Error in QuizService.getAllQuestions:', error);
      throw new Error('Failed to fetch all questions');
    }
  }


  

  async submitResponse(response: SubmitQuizResponseDto, userId: string) {
    const quiz = await this.quizModel.findById(response.questionId);
    if (!quiz) {
      throw new NotFoundException('Question not found');
    }

    const update: any = {
      $inc: { timesAnswered: 1 },
      $push: { responses: new Types.ObjectId() },
    };

    if (response.isCorrect) {
      update.$inc.timesAnsweredCorrectly = 1;
    }

    if (response.timeSpent) {
      const totalTime = quiz.averageTimeSpent * quiz.timesAnswered + response.timeSpent;
      update.$set = {
        averageTimeSpent: totalTime / (quiz.timesAnswered + 1),
      };
    }

    await this.quizModel.findByIdAndUpdate(response.questionId, update);

    return {
      isCorrect: response.isCorrect,
      correctAnswer: quiz.options.find((opt) => opt.isCorrect)?.text,
    };
  }

  async getQuizStats() {
    const stats = await this.quizModel.aggregate([
      {
        $group: {
          _id: null,
          totalQuestions: { $sum: 1 },
          totalResponses: { $sum: '$timesAnswered' },
          totalCorrect: { $sum: '$timesAnsweredCorrectly' },
          avgTimeSpent: { $avg: '$averageTimeSpent' },
        },
      },
      {
        $project: {
          _id: 0,
          totalQuestions: 1,
          totalResponses: 1,
          totalCorrect: 1,
          accuracy: {
            $cond: [
              { $eq: ['$totalResponses', 0] },
              0,
              { $divide: ['$totalCorrect', '$totalResponses'] },
            ],
          },
          avgTimeSpent: 1,
        },
      },
    ]);

    return (
      stats[0] || {
        totalQuestions: 0,
        totalResponses: 0,
        totalCorrect: 0,
        accuracy: 0,
        avgTimeSpent: 0,
      }
    );
  }

  async update(id: string, updateQuizDto: CreateQuizDto): Promise<Quiz> {
    const updatedQuiz = await this.quizModel
      .findByIdAndUpdate(id, { $set: updateQuizDto }, { new: true, runValidators: true })
      .exec();

    if (!updatedQuiz) {
      throw new NotFoundException(`Quiz with ID ${id} not found`);
    }

    return updatedQuiz;
  }

  async findAll(limit?: number): Promise<Quiz[]> {
    try {
      let query = this.quizModel.find();
      if (limit && limit > 0) {
        query = query.limit(limit);
      }
      return await query.lean().exec();
    } catch (error) {
      console.error('Error in QuizService.findAll:', error);
      throw new Error('Failed to fetch quizzes');
    }
  }

  

  async delete(id: string): Promise<void> {
    const result = await this.quizModel.deleteOne({ _id: id }).exec();
    if (result.deletedCount === 0) {
      throw new NotFoundException(`Quiz with ID ${id} not found`);
    }
  }
}
