import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ProjectDocument = Project &
  Document & { createdAt?: Date; updatedAt?: Date };

@Schema({ timestamps: true })
export class Project {
  _id: Types.ObjectId;
  @Prop({ required: true })
  name: string;

  @Prop()
  description: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  createdBy: Types.ObjectId;

  @Prop([{ type: Types.ObjectId, ref: 'User' }])
  members: Types.ObjectId[];

  @Prop({ default: true })
  isActive: boolean;
}

export const ProjectSchema = SchemaFactory.createForClass(Project);
