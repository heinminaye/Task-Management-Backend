import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../common/schemas/user.schema';
import { AdminUser } from '../common/interfaces/auth.interface';

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private userModel: Model<UserDocument>) {}

  async findAll(): Promise<UserDocument[]> {
    return this.userModel.find({ isActive: true }).exec();
  }

  async findById(id: string): Promise<UserDocument> {
    const user: UserDocument | null = await this.userModel.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async findByEmail(email: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ email }).exec();
  }

  async confirmUser(
    userId: string,
    adminUser: AdminUser,
  ): Promise<UserDocument> {
    if (!adminUser.isAdmin) {
      throw new ForbiddenException('Admin access required');
    }

    const user: UserDocument | null = await this.userModel.findByIdAndUpdate(
      userId,
      { isConfirmed: true },
      { new: true },
    );

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async updateLastSeen(userId: string, lastSeen: Date): Promise<void> {
    await this.userModel.findByIdAndUpdate(userId, { lastSeen });
  }

  async getOnlineUsers(): Promise<UserDocument[]> {
    const fiveMinutesAgo: Date = new Date(Date.now() - 5 * 60 * 1000);
    return this.userModel
      .find({
        lastSeen: { $gte: fiveMinutesAgo },
        isActive: true,
      })
      .exec();
  }
}
