import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Put,
  Delete,
  NotFoundException,
  forwardRef,
  Inject,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { QuestionService } from './question.service';
import { CreateQuestionDto } from './dto/create-question.dto';
import { UnauthorizedException } from '@nestjs/common';
import { ResponseService } from '../response/response.service';
import {
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

@ApiTags('question')
@Controller('question')
export class QuestionController {
  constructor(
    private readonly questionService: QuestionService,
    @Inject(forwardRef(() => ResponseService))
    private readonly responseService: ResponseService,
  ) {}

  @Post('create')
  @ApiOperation({ summary: 'Creates a new question' })
  @ApiCreatedResponse({ description: 'Question created successfully' })
  @ApiBadRequestResponse({ description: 'Invalid data provided' })
  @UsePipes(new ValidationPipe()) // Automatically validates incoming request data
  async create(@Body() createQuestionDto: CreateQuestionDto) {
    try {
      const question = await this.questionService.create(createQuestionDto);
      return { message: 'Question created successfully by admin', question };
    } catch (error) {
      return { message: error.message };
    }
  }

  // Get all questions

  @Get('all')
  @ApiOperation({ summary: 'Fetch a list of questions ' })
  @ApiOkResponse({
    description: 'List of questions fetched sucessfully.',
  })
  async findAll() {
    try {
      const questions = await this.questionService.findAll();
      return { message: 'Questions extracted successfully', questions };
    } catch (error) {
      return { message: error.message };
    }
  }

  @Get(':id')
  @ApiOperation({ summary: 'Fetch a question by id' })
  @ApiOkResponse({ description: 'Question found' })
  @ApiNotFoundResponse({ description: 'Question not found.' })
  async findOne(@Param('id') id: string) {
    try {
      const question = await this.questionService.findOne(id);
      if (!question) {
        throw new NotFoundException('Question not found');
      }
      const responses = await this.responseService.findByQuestionId(id); // Use ResponseService
      return { question, responses };
    } catch (error) {
      return { message: error.message };
    }
  }

  @Put('update/:id')
  @UsePipes(new ValidationPipe())
  async updateQuestion(
    @Param('id') id: string,
    @Body() updateQuestionDto: CreateQuestionDto,
  ) {
    try {
      const updatedQuestion = await this.questionService.updateQuestion(
        id,
        updateQuestionDto,
      );
      if (!updatedQuestion) {
        throw new NotFoundException('Question not found');
      }
      return { message: 'Question updated successfully', updatedQuestion };
    } catch (error) {
      return { message: error.message };
    }
  }

  @Delete('delete/:id')
  async deleteQuestion(@Param('id') id: string) {
    try {
      const response = await this.questionService.deleteQuestion(id);
      return { message: response.message };
    } catch (error) {
      return { message: error.message };
    }
  }
}
