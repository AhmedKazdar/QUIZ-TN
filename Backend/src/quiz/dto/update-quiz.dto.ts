// src/quiz/dto/update-quiz.dto.ts
import { PartialType } from '@nestjs/mapped-types';
import { CreateQuizDto } from './create-quiz.dto';

export class UpdateQuizDto extends PartialType(CreateQuizDto) {}