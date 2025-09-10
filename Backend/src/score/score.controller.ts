import {
  Controller,
  Post,
  Param,
  Get,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ScoreService } from './score.service';
import { Score } from './score.schema';
import { Types } from 'mongoose';

@Controller('score')
export class ScoreController {
  private readonly logger = new Logger(ScoreController.name);

  constructor(private readonly scoreService: ScoreService) {}

  // Endpoint to calculate score for a specific user
  @Post('calculate/:userId')
  async calculateScore(@Param('userId') userId: string): Promise<Score> {
    try {
      if (!Types.ObjectId.isValid(userId)) {
        throw new BadRequestException('Invalid userId format');
      }

      const score = await this.scoreService.calculateScore(userId); // Pass string

      // Successfully calculate score
      return score;
    } catch (error) {
      this.logger.error('calculateScore failed', error.stack);
      throw error;
    }
  }

  // Endpoint to get top 5 rankings based on score
  /* @Get('ranking')
  async getTopRanking(): Promise<Score[]> {
    return this.scoreService.getTopRanking();
  } */
}
