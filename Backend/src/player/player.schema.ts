import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type PlayerDocument = Player & Document & {
  createdAt: Date;
  updatedAt: Date;
};

@Schema({ collection: 'players', timestamps: true })
export class Player {
  @Prop({ required: true, unique: true })
  phoneNumber: string;

  @Prop({ required: false })
  username?: string;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ default: 0 })
  score: number;

  // These are populated automatically because of timestamps: true on the schema
  @Prop()
  createdAt: Date;

  @Prop()
  updatedAt: Date;
}

export const PlayerSchema = SchemaFactory.createForClass(Player);
