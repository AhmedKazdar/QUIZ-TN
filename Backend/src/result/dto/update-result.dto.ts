import { PartialType } from '@nestjs/mapped-types';
import { SubmitAnswerDto } from './submit-answer.dto';

export class UpdateResultDto extends PartialType(SubmitAnswerDto) {}
