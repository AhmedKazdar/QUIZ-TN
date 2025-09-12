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
  constructor(private readonly quizTimeService: QuizTimeService) {}

  @Post()
  @Roles(UserRole.ADMIN)
  create(@Body() createQuizTimeDto: CreateQuizTimeDto) {
    return this.quizTimeService.create(createQuizTimeDto);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.USER)
  findAll(@Query('activeOnly') activeOnly: string) {
    return this.quizTimeService.findAll(activeOnly !== 'false');
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
