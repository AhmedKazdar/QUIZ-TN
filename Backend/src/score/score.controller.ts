import {
  Controller,
  Post,
  Get,
  Param,
  Query,
  BadRequestException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ScoreService } from './score.service';
import { Score } from './score.schema';
import { Types } from 'mongoose';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';

@ApiTags('scores')
@Controller('scores')
export class ScoreController {
  private readonly logger = new Logger(ScoreController.name);

  constructor(private readonly scoreService: ScoreService) {}

  @ApiOperation({ summary: 'Calculate score for a user' })
  @ApiResponse({ status: 200, description: 'Score calculated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid user ID format' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @Post('calculate/:userId')
  async calculateScore(@Param('userId') userId: string): Promise<Score> {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid userId format');
    }
    return this.scoreService.calculateScore(userId);
  }

  @ApiOperation({ summary: 'Get user rank' })
  @ApiResponse({ status: 200, description: 'Returns user rank and total users' })
  @ApiResponse({ status: 400, description: 'Invalid user ID format' })
  @ApiResponse({ status: 404, description: 'User score not found' })
  @Get('rank/:userId')
  async getUserRank(@Param('userId') userId: string) {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid userId format');
    }
    return this.scoreService.getUserRank(userId);
  }

  @ApiOperation({ summary: 'Get leaderboard' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number (1-based)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page' })
  @ApiResponse({ status: 200, description: 'Returns paginated leaderboard' })
  @Get('leaderboard')
  async getLeaderboard(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
  ) {
    if (page < 1) page = 1;
    if (limit < 1 || limit > 100) limit = 10;
    
    return this.scoreService.getLeaderboard(page, limit);
  }

  @Get('top')
  @ApiOperation({ summary: 'Get top N scores' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Number of top scores to return' })
  @ApiResponse({ status: 200, description: 'Returns top scores', type: [Score] })
  async getTopScores(@Query('limit') limit: number = 10) {
    if (limit < 1 || limit > 100) limit = 10;
    return this.scoreService.getTopRanking(limit);
  }
}
