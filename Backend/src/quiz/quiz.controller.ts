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


  @Get('health/database')
  @ApiOperation({ summary: 'Check database health and questions' })
  async checkDatabaseHealth() {
    try {
      console.log('🔍 [HEALTH CHECK] Checking database health...');
      
      // Check connection with proper null checks
      const db = this.quizService['quizModel'].db;
      if (!db || !db.db) {
        return {
          success: false,
          database: 'disconnected',
          error: 'Database connection not established'
        };
      }
      
      const adminDb = db.db.admin();
      const pingResult = await adminDb.ping();
      
      // Get stats
      const totalQuestions = await this.quizService['quizModel'].countDocuments();
      const sampleQuestions = await this.quizService['quizModel'].find().limit(2).lean();
      
      console.log('✅ [HEALTH CHECK] Database health check passed');
      
      return {
        success: true,
        database: 'connected',
        totalQuestions,
        sampleQuestions: sampleQuestions.map(q => ({
          id: q._id,
          question: q.question,
          options: q.options?.map(opt => ({
            text: opt.text,
            isCorrect: opt.isCorrect
          }))
        }))
      };
    } catch (error) {
      console.error('❌ [HEALTH CHECK] Database health check failed:', error);
      return {
        success: false,
        database: 'disconnected',
        error: error.message
      };
    }
  }

  @Get()
  @ApiOperation({ summary: 'Get all quizzes' })
  @ApiResponse({ status: 200, description: 'Returns all quizzes' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async findAll(@Query('limit') limit?: number) {
    try {
      const quizzes = await this.quizService.findAll(limit);
      return { success: true, data: quizzes };
    } catch (error) {
      return { 
        success: false, 
        message: 'Failed to fetch quizzes',
        error: error.message 
      };
    }
  }

  @Get('all')
  @ApiOperation({ summary: 'Get all questions without limit' })
  @ApiResponse({ status: 200, description: 'Returns all questions' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async getAllQuestions() {
    try {
      const questions = await this.quizService.getAllQuestions();
      return { success: true, data: questions };
    } catch (error) {
      return { 
        success: false, 
        message: 'Failed to fetch all questions',
        error: error.message 
      };
    }
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