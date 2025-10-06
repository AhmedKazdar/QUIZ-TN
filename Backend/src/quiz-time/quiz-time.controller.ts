import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Put,
  UseGuards,
  Query,
  Logger,
  Request,
  UnauthorizedException,
} from '@nestjs/common';
import { QuizTimeService } from './quiz-time.service';
import { CreateQuizTimeDto } from './dto/create-quiz-time.dto';
import { JwtAuthGuard } from '../user/jwt-auth.guard';
import { RolesGuard } from '../user/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { UserRole } from '../user/entities/user.entity';

@Controller('quiz-times')
@UseGuards(JwtAuthGuard, RolesGuard)
export class QuizTimeController {
  private readonly logger = new Logger(QuizTimeController.name);
  constructor(private readonly quizTimeService: QuizTimeService) {}

  @Post()
  @Roles(UserRole.ADMIN)
  create(@Body() createQuizTimeDto: CreateQuizTimeDto) {
    return this.quizTimeService.create(createQuizTimeDto);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.USER)
  async findAll(@Query('activeOnly') activeOnly: string, @Request() req) {
    this.logger.log(`Fetching quiz times for user: ${req.user.userId}`);
    
    try {
      const result = await this.quizTimeService.findAll(activeOnly !== 'false');
      this.logger.log(`Found ${result.length} quiz times`);
      return result;
    } catch (error) {
      this.logger.error('Error fetching quiz times:', error);
      throw new UnauthorizedException('Unable to fetch quiz times');
    }
  }
  @Get(':id')
  @Roles(UserRole.ADMIN)
  findOne(@Param('id') id: string) {
    return this.quizTimeService.findOne(id);
  }

  @Put(':id')
  @Roles(UserRole.ADMIN)
  update(@Param('id') id: string, @Body() updateData: any) {
    return this.quizTimeService.update(id, updateData);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  remove(@Param('id') id: string) {
    return this.quizTimeService.remove(id);
  }
}
