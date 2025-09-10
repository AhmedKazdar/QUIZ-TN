import {
  Injectable,
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Score } from './score.schema';
import { ResponseDocument } from '../response/response.schema';
import { User } from '../user/user.schema';

@Injectable()
export class ScoreService {
  constructor(
    @InjectModel(Score.name) private scoreModel: Model<Score>,
    @InjectModel('Response') private responseModel: Model<ResponseDocument>,
    @InjectModel(User.name) private userModel: Model<User>,
  ) {}

  async syncUserScore(userId: string): Promise<Score> {
    try {
      if (!Types.ObjectId.isValid(userId)) {
        throw new BadRequestException('Invalid userId format');
      }
      const objectId = new Types.ObjectId(userId);

      const userExists = await this.userModel.findById(objectId);
      if (!userExists) {
        throw new NotFoundException('User not found');
      }

      console.log('Syncing score for user:', objectId.toString());
      const responses = (await this.responseModel
        .find({ userId: objectId })
        .sort({ createdAt: -1 }) // Latest response first
        .exec()) as ResponseDocument[];
      console.log('Fetched Responses:', responses.length);

      // Deduplicate by questionId, keeping the latest response
      const uniqueResponses: ResponseDocument[] = [];
      const seenQuestionIds = new Set<string>();
      for (const response of responses) {
        if (!seenQuestionIds.has(response.questionId.toString())) {
          uniqueResponses.push(response);
          seenQuestionIds.add(response.questionId.toString());
        }
      }
      console.log('Unique Responses:', uniqueResponses.length);

      const correctAnswers = uniqueResponses.filter((r) => r.isCorrect).length;
      console.log('Correct Responses Count:', correctAnswers);

      const updatedScore = await this.scoreModel.findOneAndUpdate(
        { userId: objectId },
        { score: correctAnswers, createdAt: new Date() },
        { upsert: true, new: true },
      );

      const populatedScore = await this.scoreModel
        .findById(updatedScore._id)
        .populate('userId', 'username')
        .exec();

      if (!populatedScore || !populatedScore.userId) {
        throw new InternalServerErrorException(
          'User details could not be populated for the score.',
        );
      }

      console.log('Synced Score:', populatedScore.score);
      return populatedScore;
    } catch (error) {
      console.error('Error syncing score:', error.message, error.stack);
      throw new InternalServerErrorException('Failed to sync score');
    }
  }

  async calculateScore(userId: string): Promise<Score> {
    try {
      if (!Types.ObjectId.isValid(userId)) {
        throw new BadRequestException('Invalid userId format');
      }
      const objectId = new Types.ObjectId(userId);

      const userExists = await this.userModel.findById(objectId);
      if (!userExists) {
        throw new NotFoundException('User not found');
      }

      console.log('Fetching responses for user:', objectId.toString());
      const responses = (await this.responseModel
        .find({ userId: objectId })
        .sort({ createdAt: -1 })
        .exec()) as ResponseDocument[];
      console.log('Fetched Responses:', responses.length);

      // Deduplicate by questionId
      const uniqueResponses: ResponseDocument[] = [];
      const seenQuestionIds = new Set<string>();
      for (const response of responses) {
        if (!seenQuestionIds.has(response.questionId.toString())) {
          uniqueResponses.push(response);
          seenQuestionIds.add(response.questionId.toString());
        }
      }
      console.log('Unique Responses:', uniqueResponses.length);

      const correctAnswers = uniqueResponses.filter((r) => r.isCorrect).length;
      console.log('Correct Responses Count:', correctAnswers);

      const updatedScore = await this.scoreModel.findOneAndUpdate(
        { userId: objectId },
        { score: correctAnswers, createdAt: new Date() },
        { upsert: true, new: true },
      );

      const populatedScore = await this.scoreModel
        .findById(updatedScore._id)
        .populate('userId', 'username')
        .exec();

      if (!populatedScore || !populatedScore.userId) {
        throw new InternalServerErrorException(
          'User details could not be populated for the score.',
        );
      }

      console.log('Calculated Score:', populatedScore.score);
      return populatedScore;
    } catch (error) {
      console.error(
        'Error during score calculation:',
        error.message,
        error.stack,
      );
      throw new InternalServerErrorException(
        'An error occurred while calculating the score. Please try again later.',
      );
    }
  }

  async getTopRanking(limit: number = 5): Promise<Score[]> {
    try {
      const topScores = await this.scoreModel
        .find()
        .sort({ score: -1, createdAt: -1 })
        .limit(limit)
        .populate('userId', 'username')
        .exec();
      console.log('Fetched top rankings:', topScores);
      return topScores;
    } catch (error) {
      console.error('Error fetching top rankings:', error.message, error.stack);
      throw new InternalServerErrorException('Failed to fetch top rankings');
    }
  }
}
