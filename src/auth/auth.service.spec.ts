import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException, ConflictException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { Types } from 'mongoose';
import { AuthService } from './auth.service';
import { User } from '../common/schemas/user.schema';
import { LoginDto, RegisterDto } from '../common/dtos/auth.dto';
import {
  MockUserDocument,
  MockUserModel,
  MockJwtService,
} from '../../test/types/test-types';

// -------------------------
// Mock bcrypt globally
// -------------------------
jest.mock('bcryptjs', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

describe('AuthService', () => {
  let authService: AuthService;
  let userModel: jest.Mocked<MockUserModel>;

  const mockUser: MockUserDocument = {
    _id: new Types.ObjectId('507f1f77bcf86cd799439011'),
    email: 'test@example.com',
    password: 'hashedPassword',
    name: 'Test User',
    isActive: true,
    isConfirmed: true,
    isAdmin: false,
    save: jest.fn(),
  };

  beforeEach(async () => {
    (bcrypt.hash as jest.Mock).mockResolvedValue('hashedPassword');
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    const mockUserModelValue: jest.Mocked<MockUserModel> = {
      findOne: jest.fn(),
      create: jest.fn(),
      find: jest.fn().mockReturnValue({ exec: jest.fn() } as any),
      findById: jest.fn(),
      findByIdAndUpdate: jest.fn(),
      deleteOne: jest.fn(),
      deleteMany: jest.fn(),
    };

    const mockJwtServiceValue: jest.Mocked<MockJwtService> = {
      sign: jest.fn().mockReturnValue('jwt-token'),
      verify: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getModelToken(User.name), useValue: mockUserModelValue },
        { provide: JwtService, useValue: mockJwtServiceValue },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
    userModel = module.get(getModelToken(User.name));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ---------------------------
  // REGISTER TESTS
  // ---------------------------
  describe('register', () => {
    const registerDto: RegisterDto = {
      email: 'new@example.com',
      password: 'password123',
      name: 'New User',
    };

    it('should register a new user successfully', async () => {
      userModel.findOne.mockResolvedValue(null);
      userModel.create.mockResolvedValue({
        ...mockUser,
        ...registerDto,
        isConfirmed: false,
      });

      const result = await authService.register(registerDto);

      expect(userModel.findOne).toHaveBeenCalledWith({
        email: registerDto.email,
      });
      expect(userModel.create).toHaveBeenCalled();
      expect(result).toEqual({
        message: 'Registration successful. Please wait for admin confirmation.',
      });
    });

    it('should throw ConflictException for duplicate email', async () => {
      userModel.findOne.mockResolvedValue(mockUser);

      await expect(authService.register(registerDto)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  // ---------------------------
  // LOGIN TESTS
  // ---------------------------
  describe('login', () => {
    const loginDto: LoginDto = {
      email: 'test@example.com',
      password: 'password123',
    };

    it('should login successfully with valid credentials', async () => {
      userModel.findOne.mockResolvedValue(mockUser);

      // bcrypt.compare is mocked globally
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await authService.login(loginDto);

      expect(userModel.findOne).toHaveBeenCalledWith({ email: loginDto.email });
      expect(bcrypt.compare).toHaveBeenCalledWith(
        loginDto.password,
        mockUser.password,
      );
      expect(result.accessToken).toBe('jwt-token');
      expect(result.user.email).toBe(mockUser.email);
    });

    it('should throw UnauthorizedException for invalid password', async () => {
      userModel.findOne.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(authService.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException for unconfirmed user', async () => {
      userModel.findOne.mockResolvedValue({ ...mockUser, isConfirmed: false });

      await expect(authService.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException for inactive user', async () => {
      userModel.findOne.mockResolvedValue({ ...mockUser, isActive: false });

      await expect(authService.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  // ---------------------------
  // VALIDATE USER TESTS
  // ---------------------------
  describe('validateUser', () => {
    it('should return authenticated user for valid user', async () => {
      userModel.findById.mockResolvedValue(mockUser);

      const result = await authService.validateUser({
        email: mockUser.email!,
        sub: mockUser._id!.toString(),
      });

      expect(result).toEqual({
        id: mockUser._id!.toString(),
        email: mockUser.email!,
        name: mockUser.name!,
        isAdmin: mockUser.isAdmin!,
        isConfirmed: mockUser.isConfirmed!,
      });
    });

    it('should throw UnauthorizedException if user not found', async () => {
      userModel.findById.mockResolvedValue(null);

      await expect(
        authService.validateUser({ email: 'x@example.com', sub: '123' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if user inactive or unconfirmed', async () => {
      userModel.findById.mockResolvedValue({ ...mockUser, isActive: false });

      await expect(
        authService.validateUser({
          email: mockUser.email!,
          sub: mockUser._id!.toString(),
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
