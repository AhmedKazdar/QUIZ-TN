import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Quiz, QuizDocument } from './schemas/quiz.schema';
import { CreateQuizDto, SubmitQuizResponseDto } from './dto/create-quiz.dto';

export interface QuizQuestion {
  id: string;
  question: string;
  options: { id: string; text: string }[];
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

  async getRandomQuestions(limit: number = 10, category?: string, difficulty?: string): Promise<QuizQuestion[]> {
    const match: any = {};
    if (category) match.category = category;
    if (difficulty) match.difficulty = difficulty;

    const pipeline: any[] = [
      { $match: match },
      { $sample: { size: limit } },
      {
        $project: {
          _id: 1,
          question: 1,
          category: 1,
          difficulty: 1,
          options: {
            $map: {
              input: '$options',
              as: 'option',
              in: {
                id: { $toString: '$$option._id' },
                text: '$$option.text'
              }
            }
          }
        }
      }
    ];

    const questions = await this.quizModel.aggregate(pipeline).exec();
    
    return questions.map(q => ({
      id: q._id.toString(),
      question: q.question,
      options: q.options,
      category: q.category,
      difficulty: q.difficulty
    }));
  }

  async submitResponse(response: SubmitQuizResponseDto, userId: string) {
    const quiz = await this.quizModel.findById(response.questionId);
    if (!quiz) {
      throw new NotFoundException('Question not found');
    }

    const update: any = {
      $inc: { timesAnswered: 1 },
      $push: { responses: new Types.ObjectId() } // In a real app, you'd create a Response document
    };

    if (response.isCorrect) {
      update.$inc.timesAnsweredCorrectly = 1;
    }

    // Update average time spent (simple moving average)
    if (response.timeSpent) {
      const totalTime = quiz.averageTimeSpent * quiz.timesAnswered + response.timeSpent;
      update.$set = {
        averageTimeSpent: totalTime / (quiz.timesAnswered + 1)
      };
    }

    await this.quizModel.findByIdAndUpdate(response.questionId, update);

    return {
      isCorrect: response.isCorrect,
      correctAnswer: quiz.options.find(opt => opt.isCorrect)?.text
    };
  }


  async getQuizStats() {
    const stats = await this.quizModel.aggregate([
      {
        $group: {
          _id: null,
          totalQuestions: { $sum: 1 },
          totalResponses: { $sum: "$timesAnswered" },
          totalCorrect: { $sum: "$timesAnsweredCorrectly" },
          avgTimeSpent: { $avg: "$averageTimeSpent" }
        }
      },
      {
        $project: {
          _id: 0,
          totalQuestions: 1,
          totalResponses: 1,
          totalCorrect: 1,
          accuracy: {
            $cond: [
              { $eq: ["$totalResponses", 0] },
              0,
              { $divide: ["$totalCorrect", "$totalResponses"] }
            ]
          },
          avgTimeSpent: 1
        }
      }
    ]);

    return stats[0] || {
      totalQuestions: 0,
      totalResponses: 0,
      totalCorrect: 0,
      accuracy: 0,
      avgTimeSpent: 0
    };
  }

  async update(id: string, updateQuizDto: CreateQuizDto): Promise<Quiz> {
    const updatedQuiz = await this.quizModel
      .findByIdAndUpdate(
        id,
        { $set: updateQuizDto },
        { new: true, runValidators: true }
      )
      .exec();
    
    if (!updatedQuiz) {
      throw new NotFoundException(`Quiz with ID ${id} not found`);
    }
    
    return updatedQuiz;
  }

  async findAll() {
    return this.quizModel.find().sort({ createdAt: -1 }).exec();
  }

  async delete(id: string): Promise<void> {
    const result = await this.quizModel.deleteOne({ _id: id }).exec();
    if (result.deletedCount === 0) {
      throw new NotFoundException(`Quiz with ID ${id} not found`);
    }
  }
}
