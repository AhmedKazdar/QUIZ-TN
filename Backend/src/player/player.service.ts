// backend/src/player/player.service.ts
import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { RegisterPlayerDto } from './dto/register-player.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { Player, PlayerDocument } from './player.schema';

@Injectable()
export class PlayerService {
  constructor(
    @InjectModel(Player.name) private readonly playerModel: Model<PlayerDocument>,
  ) {}

  async findByPhoneNumber(phoneNumber: string): Promise<PlayerDocument | null> {
    return this.playerModel.findOne({ phoneNumber }).exec();
  }

  async findById(id: string): Promise<PlayerDocument | null> {
    try {
      return await this.playerModel.findById(id).exec();
    } catch {
      return null;
    }
  }

  async create(createPlayerDto: RegisterPlayerDto): Promise<PlayerDocument> {
    const { phoneNumber, username } = createPlayerDto;

    const existingPlayer = await this.findByPhoneNumber(phoneNumber);
    if (existingPlayer) {
      throw new ConflictException('Player with this phone number already exists');
    }

    const player = new this.playerModel({
      phoneNumber,
      username,
      isActive: true,
      score: 0,
    });

    return player.save();
  }

  async verifyOtp(verifyOtpDto: VerifyOtpDto): Promise<PlayerDocument> {
    const { phoneNumber, username } = verifyOtpDto;

    let player = await this.findByPhoneNumber(phoneNumber);

    if (!player) {
      if (!username) {
        throw new Error('Username is required for new players');
      }
      player = await this.create({ phoneNumber, username });
    }

    return player;
  }

  async updatePlayer(playerId: string, updateData: Partial<Player>): Promise<PlayerDocument> {
    const player = await this.playerModel.findById(playerId).exec();
    if (!player) {
      throw new NotFoundException('Player not found');
    }

    Object.assign(player, updateData);
    return player.save();
  }
}