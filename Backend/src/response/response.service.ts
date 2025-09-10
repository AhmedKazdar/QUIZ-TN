import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, Document } from 'mongoose';
import { Response } from './response.schema';
import { CreateResponseDto } from './dto/create-response.dto';
import { UpdateResponseDto } from './dto/update-response.dto';

// Ensure ResponseDocument includes _id
export type ResponseDocument = Response & Document & { _id: Types.ObjectId };

@Injectable()
export class ResponseService {
  constructor(
    @InjectModel(Response.name)
    private readonly responseModel: Model<ResponseDocument>,
  ) {}

  async create(
    createResponseDto: CreateResponseDto,
  ): Promise<ResponseDocument> {
    if (
      !createResponseDto.userId ||
      !createResponseDto.questionId ||
      typeof createResponseDto.isCorrect !== 'boolean'
    ) {
      throw new BadRequestException('Missing required fields');
    }

    try {
      const response: ResponseDocument = new this.responseModel({
        userId: new Types.ObjectId(createResponseDto.userId),
        questionId: new Types.ObjectId(createResponseDto.questionId),
        isCorrect: createResponseDto.isCorrect,
        text: createResponseDto.text || null,
      }) as ResponseDocument;

      const savedResponse = (await response.save()) as ResponseDocument;
      console.log('Response saved successfully:', {
        _id: savedResponse._id.toString(),
        userId: savedResponse.userId.toString(),
        questionId: savedResponse.questionId.toString(),
        isCorrect: savedResponse.isCorrect,
        text: savedResponse.text,
      });
      return savedResponse;
    } catch (error) {
      if (error.code === 11000) {
        console.log('Duplicate response detected:', {
          userId: createResponseDto.userId,
          questionId: createResponseDto.questionId,
        });
        throw new BadRequestException(
          'Response already exists for this user and question',
        );
      }
      console.error('Error saving response:', error.message);
      throw new BadRequestException(
        'Failed to save response: ' + error.message,
      );
    }
  }

  async createMultiple(
    createResponseDtos: CreateResponseDto[],
  ): Promise<ResponseDocument[]> {
    const responses = createResponseDtos.map((dto) => ({
      text: dto.text,
      questionId: new Types.ObjectId(dto.questionId),
      isCorrect: dto.isCorrect,
      userId: new Types.ObjectId(dto.userId),
    }));

    console.log('Responses to be inserted:', responses);

    try {
      return (await this.responseModel.insertMany(responses, {
        ordered: false,
      })) as ResponseDocument[];
    } catch (error) {
      if (error.code === 11000) {
        console.log('Duplicate responses detected during bulk insert');
        throw new BadRequestException('One or more responses already exist');
      }
      console.error('Error inserting multiple responses:', error.message);
      throw new BadRequestException('Failed to insert responses');
    }
  }

  async findByUserAndQuestion(
    userId: string,
    questionId: string,
  ): Promise<ResponseDocument | null> {
    try {
      if (
        !Types.ObjectId.isValid(userId) ||
        !Types.ObjectId.isValid(questionId)
      ) {
        console.warn('Invalid ID format:', { userId, questionId });
        throw new BadRequestException('Invalid userId or questionId format');
      }
      const userObjectId = new Types.ObjectId(userId);
      const questionObjectId = new Types.ObjectId(questionId);
      const response = (await this.responseModel
        .findOne({
          userId: userObjectId,
          questionId: questionObjectId,
        })
        .exec()) as ResponseDocument | null;
      console.log('Checked for existing response:', {
        userId: userObjectId.toString(),
        questionId: questionObjectId.toString(),
        found: !!response,
        responseId: response?._id?.toString(),
        responseUserId: response?.userId?.toString(),
        responseQuestionId: response?.questionId?.toString(),
      });
      return response;
    } catch (error) {
      console.error('Error checking existing response:', error.message);
      throw new BadRequestException('Failed to check existing response');
    }
  }

  async findAll(): Promise<ResponseDocument[]> {
    return this.responseModel.find().populate('questionId').exec() as Promise<
      ResponseDocument[]
    >;
  }

  async findById(id: string): Promise<ResponseDocument> {
    const response = (await this.responseModel
      .findById(id)
      .populate('questionId')) as ResponseDocument;
    if (!response) throw new NotFoundException('Response not found');
    return response;
  }

  async findByUserId(userId: string): Promise<ResponseDocument[]> {
    try {
      if (!Types.ObjectId.isValid(userId)) {
        throw new BadRequestException('Invalid userId format');
      }
      const responses = (await this.responseModel
        .find({ userId: new Types.ObjectId(userId) })
        .exec()) as ResponseDocument[];
      console.log(
        'Fetched responses for user:',
        userId,
        'count:',
        responses.length,
      );
      return responses;
    } catch (error) {
      console.error('Error fetching responses by userId:', error.message);
      throw new BadRequestException('Failed to fetch responses');
    }
  }

  async deleteByUserId(userId: string): Promise<{ message: string }> {
    try {
      if (!Types.ObjectId.isValid(userId)) {
        throw new BadRequestException('Invalid userId format');
      }
      const userObjectId = new Types.ObjectId(userId);
      const result = await this.responseModel
        .deleteMany({ userId: userObjectId })
        .exec();
      console.log(
        `Deleted ${result.deletedCount} responses for user: ${userId}`,
      );
      return {
        message: `Deleted ${result.deletedCount} responses successfully`,
      };
    } catch (error) {
      console.error('Error deleting responses for user:', error.message);
      throw new InternalServerErrorException('Failed to delete responses');
    }
  }

  async update(
    id: string,
    updateDto: UpdateResponseDto,
  ): Promise<ResponseDocument> {
    const updated = (await this.responseModel
      .findByIdAndUpdate(id, updateDto, {
        new: true,
        runValidators: true,
      })
      .populate('questionId')) as ResponseDocument;
    if (!updated) throw new NotFoundException('Response not found');
    return updated;
  }

  async delete(id: string): Promise<{ message: string }> {
    const deleted = (await this.responseModel.findByIdAndDelete(
      id,
    )) as ResponseDocument;
    if (!deleted) throw new NotFoundException('Response not found');
    return { message: 'Response deleted successfully' };
  }

  async findAllWithQuestions(): Promise<ResponseDocument[]> {
    return this.responseModel.find().populate('questionId').exec() as Promise<
      ResponseDocument[]
    >;
  }

  async findByQuestionId(questionId: string): Promise<ResponseDocument[]> {
    console.log('Searching for responses with questionId:', questionId);
    const responses = (await this.responseModel
      .find({ questionId: new Types.ObjectId(questionId) })
      .populate('questionId')
      .exec()) as ResponseDocument[];
    console.log('Found responses:', responses);
    return responses;
  }
}
