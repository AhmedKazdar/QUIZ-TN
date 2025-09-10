import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Put,
  Delete,
  NotFoundException,
  BadRequestException,
  Query,
} from '@nestjs/common';
import { ResponseService } from './response.service';
import { UserService } from '../user/user.service';
import { QuestionService } from '../question/question.service';
import { ScoreService } from '../score/score.service';
import { CreateResponseDto } from './dto/create-response.dto';
import { UpdateResponseDto } from './dto/update-response.dto';
import { SubmitAnswerDto } from './dto/submit-answer.dto';
import {
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Types, Document } from 'mongoose';

// Ensure ResponseDocument includes _id
export type ResponseDocument = Document & {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  questionId: Types.ObjectId;
  isCorrect: boolean;
  text: string;
};

@ApiTags('response')
@Controller('response')
export class ResponseController {
  constructor(
    private readonly responseService: ResponseService,
    private readonly userService: UserService,
    private readonly questionService: QuestionService,
    private readonly scoreService: ScoreService,
  ) {}

  @Post('submit')
  @ApiOperation({
    summary: 'Submit multiple responses (userId, questionId, isCorrect)',
  })
  @ApiCreatedResponse({ description: 'Responses submitted successfully' })
  @ApiBadRequestResponse({ description: 'Invalid data provided' })
  @ApiNotFoundResponse({ description: 'User or Question not found' })
  async submitResponses(@Body() responses: any[]) {
    if (!responses || !Array.isArray(responses) || responses.length === 0) {
      throw new BadRequestException('Invalid or empty responses array');
    }

    const results: ResponseDocument[] = [];
    let totalScore = 0;
    const userId = responses[0]?.userId;

    if (!userId || !Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid or missing userId');
    }

    console.log('Submitting responses for userId:', userId);

    const user = await this.userService.findById(userId);
    if (!user) {
      throw new NotFoundException(`User ${userId} not found`);
    }

    for (const responseData of responses) {
      const {
        userId: responseUserId,
        questionId,
        isCorrect,
        text,
        selectedAnswerText,
      } = responseData;

      console.log('Processing response data:', responseData);

      if (
        !responseUserId ||
        !questionId ||
        typeof isCorrect !== 'boolean' ||
        !(text || selectedAnswerText) ||
        responseUserId !== userId
      ) {
        console.warn('Invalid response data, skipping:', {
          responseUserId,
          questionId,
          isCorrect,
          text,
          selectedAnswerText,
          userIdMatch: responseUserId === userId,
        });
        continue;
      }

      if (!Types.ObjectId.isValid(questionId)) {
        console.warn('Invalid questionId format, skipping:', questionId);
        continue;
      }

      try {
        console.log('Fetching question with ID:', questionId);
        const question = await this.questionService.findById(questionId);
        if (!question) {
          console.warn('Question not found for ID:', questionId);
          continue;
        }

        console.log(
          'Checking for existing response for user:',
          userId,
          'question:',
          questionId,
        );
        const existingResponse =
          (await this.responseService.findByUserAndQuestion(
            userId,
            questionId,
          )) as ResponseDocument | null;

        let newResponse: ResponseDocument;

        if (existingResponse) {
          console.log(
            'Updating existing response for user:',
            userId,
            'question:',
            questionId,
            'responseId:',
            existingResponse._id.toString(),
            'old isCorrect:',
            existingResponse.isCorrect,
            'new isCorrect:',
            isCorrect,
          );
          newResponse = (await this.responseService.update(
            existingResponse._id.toString(),
            {
              userId,
              questionId,
              isCorrect,
              text: text || selectedAnswerText,
            },
          )) as ResponseDocument;
        } else {
          newResponse = (await this.responseService.create({
            userId,
            questionId,
            isCorrect,
            text: text || selectedAnswerText,
          })) as ResponseDocument;
          console.log('New Response Saved:', {
            _id: newResponse._id.toString(),
            userId: newResponse.userId.toString(),
            questionId: newResponse.questionId.toString(),
            isCorrect: newResponse.isCorrect,
            text: newResponse.text,
          });
        }

        results.push(newResponse);
        if (newResponse.isCorrect) {
          totalScore += 1;
        }
      } catch (error) {
        console.error(
          'Error processing response for question:',
          questionId,
          error.message,
        );
        const errorResponse = {
          _id: new Types.ObjectId(),
          userId: new Types.ObjectId(userId),
          questionId: new Types.ObjectId(questionId),
          isCorrect,
          text: `Error: ${error.message}`,
        } as ResponseDocument;
        results.push(errorResponse);
      }
    }

    console.log('Final Score:', totalScore);

    try {
      const updatedScore = await this.scoreService.syncUserScore(userId);
      console.log('Updated Score in DB:', updatedScore);
    } catch (error) {
      console.error('Error syncing score:', error.message);
    }

    return {
      message: 'Responses submitted successfully',
      responses: results,
      score: totalScore,
    };
  }

  @Get()
  @ApiOperation({ summary: 'Fetch a list of responses' })
  @ApiOkResponse({ description: 'List of responses fetched successfully' })
  async findAll(@Query('userId') userId?: string) {
    try {
      if (userId) {
        if (!Types.ObjectId.isValid(userId)) {
          throw new BadRequestException('Invalid userId format');
        }
        const responses = await this.responseService.findByUserId(userId);
        return { message: 'Fetched user responses', responses };
      }
      const responses = await this.responseService.findAllWithQuestions();
      return { message: 'Fetched all responses', responses };
    } catch (error) {
      return { message: error.message };
    }
  }

  @Get('question/:questionId')
  @ApiOperation({ summary: 'Fetch responses by questionId' })
  @ApiOkResponse({ description: 'Responses found' })
  @ApiNotFoundResponse({ description: 'No responses found for the question' })
  async findByQuestionId(@Param('questionId') questionId: string) {
    try {
      const responses = await this.responseService.findByQuestionId(questionId);
      if (responses.length === 0) {
        return { message: 'No responses found for this question' };
      }
      return { message: 'Fetched responses for question', responses };
    } catch (error) {
      return { message: error.message };
    }
  }

  @Post('create')
  @ApiOperation({ summary: 'Creates a new response' })
  @ApiCreatedResponse({ description: 'Response created successfully' })
  @ApiBadRequestResponse({ description: 'Invalid data provided' })
  async create(@Body() createResponseDto: CreateResponseDto) {
    const { questionId } = createResponseDto;

    if (!Types.ObjectId.isValid(questionId)) {
      throw new BadRequestException('Invalid questionId format');
    }

    try {
      const response = await this.responseService.create(createResponseDto);
      return { message: 'Response created successfully', response };
    } catch (error) {
      throw new BadRequestException('Failed to create response');
    }
  }

  @Post('create-multiple')
  @ApiOperation({ summary: 'Creates multiple responses' })
  @ApiCreatedResponse({ description: 'Responses created successfully' })
  @ApiBadRequestResponse({ description: 'Invalid data provided' })
  async createMultiple(@Body() createResponseDtos: CreateResponseDto[]) {
    try {
      const responses =
        await this.responseService.createMultiple(createResponseDtos);
      return { message: 'Responses created successfully', responses };
    } catch (error) {
      return { message: error.message };
    }
  }

  @Get('ping')
  ping() {
    return 'pong';
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() updateResponseDto: UpdateResponseDto,
  ) {
    try {
      const updatedResponse = await this.responseService.update(
        id,
        updateResponseDto,
      );
      return { message: 'Response updated successfully', updatedResponse };
    } catch (error) {
      return { message: error.message };
    }
  }
  @Delete('user/:userId')
  @ApiOperation({ summary: 'Delete all responses for a user' })
  @ApiOkResponse({ description: 'Responses deleted successfully' })
  @ApiBadRequestResponse({ description: 'Invalid userId format' })
  async deleteByUserId(@Param('userId') userId: string) {
    try {
      return await this.responseService.deleteByUserId(userId);
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }
  @Delete(':id')
  async delete(@Param('id') id: string) {
    try {
      const deleteResult = await this.responseService.delete(id);
      return { message: deleteResult.message };
    } catch (error) {
      return { message: error.message };
    }
  }
}
