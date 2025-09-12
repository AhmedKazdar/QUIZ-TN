import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateQuizTimeDto } from './dto/create-quiz-time.dto';
import { QuizTime, QuizTimeDocument } from './entities/quiz-time.entity';

@Injectable()
export class QuizTimeService {
  constructor(
    @InjectModel(QuizTime.name) private quizTimeModel: Model<QuizTimeDocument>,
  ) {}

  async create(createQuizTimeDto: CreateQuizTimeDto): Promise<QuizTime> {
    // Check if time already exists
    const existingTime = await this.quizTimeModel.findOne({
      time: createQuizTimeDto.time,
    });

    if (existingTime) {
      throw new Error('This quiz time already exists');
    }

    const createdTime = new this.quizTimeModel(createQuizTimeDto);
    return createdTime.save();
  }

  async findAll(activeOnly = true): Promise<QuizTime[]> {
    const query = activeOnly ? { isActive: true } : {};
    return this.quizTimeModel
      .find(query)
      .sort({ time: 1 })
      .exec();
  }

  async findOne(id: string): Promise<QuizTime | null> {
    return this.quizTimeModel.findById(id).exec();
  }

  async update(id: string, updateData: Partial<QuizTime>): Promise<QuizTime | null> {
    const updated = await this.quizTimeModel
      .findByIdAndUpdate(id, updateData, { new: true })
      .exec();
    
    if (!updated) {
      throw new Error('Quiz time not found');
    }
    
    return updated;
  }

  async remove(id: string): Promise<QuizTime | null> {
    const deleted = await this.quizTimeModel.findByIdAndDelete(id).exec();
    
    if (!deleted) {
      throw new Error('Quiz time not found');
    }
    
    return deleted;
  }
}
