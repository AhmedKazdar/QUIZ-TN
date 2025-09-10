import { Controller, Post, Body, Get, Query, Param } from '@nestjs/common';
import { ResultService } from './result.service';
import { SubmitAnswerDto } from './dto/submit-answer.dto';
import { ResultDto } from './dto/result.dto';

@Controller('results')
export class ResultController {
  constructor(private readonly resultService: ResultService) {}

  @Post('submit')
  async submitAnswer(
    @Body() submitAnswerDto: SubmitAnswerDto,
  ): Promise<ResultDto[]> {
    return this.resultService.submitAnswer(submitAnswerDto);
  }

  @Get()
  async findAll(
    @Query('page') page = '1',
    @Query('limit') limit = '10',
  ): Promise<ResultDto[]> {
    // Convert query params from string to number
    const pageNumber = parseInt(page, 10);
    const limitNumber = parseInt(limit, 10);

    return this.resultService.findAll(pageNumber, limitNumber);
  }
}
