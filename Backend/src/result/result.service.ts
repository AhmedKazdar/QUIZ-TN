import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Result, ResultDocument } from './result.schema';
import { ResultDto } from './dto/result.dto'; // Import ResultDto
import { SubmitAnswerDto } from './dto/submit-answer.dto';
import { Response, ResponseDocument } from '../response/response.schema';
import { User, UserDocument } from '../user/user.schema';
import { Question, QuestionDocument } from '../question/question.schema';

@Injectable()
export class ResultService {
  constructor(
    @InjectModel(Result.name) private resultModel: Model<ResultDocument>,
    @InjectModel(Response.name) private responseModel: Model<ResponseDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Question.name) private questionModel: Model<QuestionDocument>,
  ) {}

  // Submit an answer and return ResultDto[]
  async submitAnswer(dto: SubmitAnswerDto): Promise<ResultDto[]> {
    // Ensure that quizId exists in the database

    // Continue with processing the answers
    const results: ResultDto[] = [];

    for (const answer of dto.answers) {
      const question = await this.questionModel.findById(answer.questionId);
      if (!question) throw new NotFoundException('Question not found');

      const response = await this.responseModel.findById(
        answer.selectedResponseId,
      );
      if (!response) throw new NotFoundException('Response not found');

      if (!response.questionId.equals(answer.questionId)) {
        throw new NotFoundException(
          'Response does not belong to the provided question',
        );
      }

      const isCorrect = response.isCorrect;

      const result = new this.resultModel({
        userId: new Types.ObjectId(dto.userId),
        quizId: new Types.ObjectId(dto.quizId),
        questionId: new Types.ObjectId(answer.questionId),
        selectedResponseId: new Types.ObjectId(answer.selectedResponseId),
        isCorrect,
      });

      await result.save();

      const resultDto: ResultDto = {
        userId: result.userId.toString(),
        questionId: result.questionId.toString(),
        selectedResponseId: result.selectedResponseId.toString(),
        quizId: result.quizId.toString(),
        isCorrect: result.isCorrect,
      };

      results.push(resultDto);
    }

    return results;
  }

  // Get all results and return ResultDto[]
  async findAll(page: number = 1, limit: number = 10): Promise<ResultDto[]> {
    const results = await this.resultModel
      .find()
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('userId', 'name')
      .populate('questionId', 'questionText')
      .populate('selectedResponseId', 'responseText')
      .populate('quizId', 'quizName')
      .sort({ createdAt: -1 });

    return results.map((result) => ({
      userId: result.userId.toString(),
      questionId: result.questionId.toString(),
      selectedResponseId: result.selectedResponseId.toString(),
      quizId: result.quizId.toString(),
      isCorrect: result.isCorrect,
    }));
  }
}
