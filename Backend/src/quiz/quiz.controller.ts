import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Query, Request } from '@nestjs/common';
import { QuizService } from './quiz.service';
import { CreateQuizDto, SubmitQuizResponseDto } from './dto/create-quiz.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('quiz')
@Controller('quiz')
export class QuizController {
  constructor(private readonly quizService: QuizService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new quiz question' })
  @ApiResponse({ status: 201, description: 'The quiz question has been successfully created.' })
  @ApiResponse({ status: 400, description: 'Invalid input.' })
  create(@Body() createQuizDto: CreateQuizDto) {
    return this.quizService.create(createQuizDto);
  }


@Get()
@ApiOperation({ summary: 'Get all quizzes' })
@ApiResponse({ status: 200, description: 'Returns all quizzes' })
async findAll() {
  return this.quizService.findAll();
}
  @Post('submit')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Submit a quiz response' })
  @ApiResponse({ status: 200, description: 'Response submitted successfully.' })
  @ApiResponse({ status: 404, description: 'Question not found.' })
  submitResponse(@Body() submitResponseDto: SubmitQuizResponseDto, @Request() req: any) {
    return this.quizService.submitResponse(submitResponseDto, req.user.userId);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get quiz statistics' })
  @ApiResponse({ status: 200, description: 'Returns quiz statistics.' })
  getStats() {
    return this.quizService.getQuizStats();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific quiz question' })
  @ApiResponse({ status: 200, description: 'Returns the quiz question.' })
  @ApiResponse({ status: 404, description: 'Question not found.' })
  findOne(@Param('id') id: string) {
    return this.quizService.findById(id);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a quiz question' })
  @ApiResponse({ status: 200, description: 'The quiz question has been successfully updated.' })
  @ApiResponse({ status: 400, description: 'Invalid input.' })
  @ApiResponse({ status: 404, description: 'Quiz not found.' })
  update(@Param('id') id: string, @Body() updateQuizDto: CreateQuizDto) {
    return this.quizService.update(id, updateQuizDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a quiz question' })
  @ApiResponse({ status: 200, description: 'The quiz question has been successfully deleted.' })
  @ApiResponse({ status: 404, description: 'Quiz not found.' })
  async remove(@Param('id') id: string) {
    await this.quizService.delete(id);
    return { message: 'Quiz deleted successfully' };
  }
}
