import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import { User, UserDocument } from '../common/schemas/user.schema';
import {
  LoginDto,
  RegisterDto,
  AuthResponseDto,
} from '../common/dtos/auth.dto';
import {
  AuthenticatedUser,
  JwtPayload,
} from '../common/interfaces/auth.interface';

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private jwtService: JwtService,
  ) {}

  async register(registerDto: RegisterDto): Promise<{ message: string }> {
    const existingUser: UserDocument | null = await this.userModel.findOne({
      email: registerDto.email,
    });
    if (existingUser) {
      throw new ConflictException('User already exists');
    }

    const hashedPassword: string = await bcrypt.hash(registerDto.password, 12);
    await this.userModel.create({
      ...registerDto,
      password: hashedPassword,
      isConfirmed: false,
    });

    return {
      message: 'Registration successful. Please wait for admin confirmation.',
    };
  }

  async login(loginDto: LoginDto): Promise<AuthResponseDto> {
    const user: UserDocument | null = await this.userModel.findOne({
      email: loginDto.email,
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isConfirmed) {
      throw new UnauthorizedException('Account pending admin confirmation');
    }

    const isPasswordValid: boolean = await bcrypt.compare(
      loginDto.password,
      user.password,
    );
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload: JwtPayload = {
      email: user.email,
      sub: user._id.toString(),
    };
    const accessToken: string = this.jwtService.sign(payload);
    return {
      accessToken,
      user: {
        id: user._id.toString(),
        email: user.email,
        name: user.name,
        isAdmin: user.isAdmin,
        isConfirmed: user.isConfirmed,
      },
    };
  }

  async validateUser(payload: JwtPayload): Promise<AuthenticatedUser> {
    const user: UserDocument | null = await this.userModel.findById(
      payload.sub,
    );
    if (!user || !user.isActive || !user.isConfirmed) {
      throw new UnauthorizedException('Invalid user');
    }
    return {
      id: user._id.toString(),
      email: user.email,
      isAdmin: user.isAdmin,
      isConfirmed: user.isConfirmed,
      name: user.name,
    };
  }
}
