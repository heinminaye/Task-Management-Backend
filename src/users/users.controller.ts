import {
  Controller,
  Get,
  Param,
  Patch,
  UseGuards,
  Request,
  ForbiddenException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UsersService } from './users.service';
import { UserDocument } from '../common/schemas/user.schema';
import type {
  AuthenticatedRequest,
  AdminUser,
} from '../common/interfaces/auth.interface';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  getMyProfile(@Request() req: AuthenticatedRequest) {
    return req.user;
  }
  // Admin-only: get all active users
  @Get()
  async findAll(@Request() req: AuthenticatedRequest): Promise<UserDocument[]> {
    if (!req.user.isAdmin) {
      throw new ForbiddenException('Admin access required');
    }
    return this.usersService.findAll();
  }

  // Get a user by ID (self or admin)
  @Get(':id')
  async findById(
    @Param('id') id: string,
    @Request() req: AuthenticatedRequest,
  ): Promise<UserDocument> {
    if (id !== req.user.id && !req.user.isAdmin) {
      throw new ForbiddenException('Access denied');
    }
    return this.usersService.findById(id);
  }

  // Admin-only: confirm a user
  @Patch(':id/confirm')
  async confirmUser(
    @Param('id') userId: string,
    @Request() req: AuthenticatedRequest,
  ): Promise<UserDocument> {
    return this.usersService.confirmUser(userId, req.user as AdminUser);
  }

  @Get('online')
  async getOnlineUsers(): Promise<UserDocument[]> {
    return this.usersService.getOnlineUsers();
  }
}
