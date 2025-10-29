import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { Types } from 'mongoose';
import { UsersService } from './users.service';
import { User } from '../common/schemas/user.schema';
import { MockUserModel, MockUserDocument } from '../../test/types/test-types';

describe('UsersService', () => {
  let usersService: UsersService;
  let userModel: jest.Mocked<MockUserModel>;

  const mockUser: MockUserDocument = {
    _id: new Types.ObjectId('507f1f77bcf86cd799439011'),
    email: 'test@example.com',
    password: 'hashedPassword',
    name: 'Test User',
    isActive: true,
    isConfirmed: false,
    isAdmin: false,
    lastSeen: new Date(),
    save: jest.fn(),
  };

  const mockAdminUser: MockUserDocument = {
    _id: new Types.ObjectId('507f1f77bcf86cd799439012'),
    email: 'admin@example.com',
    password: 'hashedPassword',
    name: 'Admin User',
    isActive: true,
    isConfirmed: true,
    isAdmin: true,
    lastSeen: new Date(),
    save: jest.fn(),
  };

  beforeEach(async () => {
    const mockUserModelValue: jest.Mocked<MockUserModel> = {
      findOne: jest.fn(),
      create: jest.fn(),
      find: jest.fn(),
      findById: jest.fn(),
      findByIdAndUpdate: jest.fn(),
      deleteOne: jest.fn(),
      deleteMany: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getModelToken(User.name), useValue: mockUserModelValue },
      ],
    }).compile();

    usersService = module.get<UsersService>(UsersService);
    userModel = module.get(getModelToken(User.name));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return all active users', async () => {
      const execMock = jest.fn().mockResolvedValue([mockUser, mockAdminUser]);
      userModel.find.mockReturnValue({ exec: execMock } as any);

      const result = await usersService.findAll();
      expect(userModel.find).toHaveBeenCalledWith({ isActive: true });
      expect(result).toEqual([mockUser, mockAdminUser]);
    });
  });

  describe('findById', () => {
    it('should return user by id', async () => {
      userModel.findById.mockResolvedValue(mockUser);
      const result = await usersService.findById(mockUser._id!.toString());
      expect(result).toEqual(mockUser);
    });

    it('should throw NotFoundException if user not found', async () => {
      userModel.findById.mockResolvedValue(null);
      await expect(usersService.findById('invalid-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findByEmail', () => {
    it('should return user by email', async () => {
      const execMock = jest.fn().mockResolvedValue(mockUser);
      userModel.findOne.mockReturnValue({ exec: execMock } as any);
      const result = await usersService.findByEmail(mockUser.email!);
      expect(result).toEqual(mockUser);
    });

    it('should return null if user not found', async () => {
      const execMock = jest.fn().mockResolvedValue(null);
      userModel.findOne.mockReturnValue({ exec: execMock } as any);
      const result = await usersService.findByEmail('nonexistent@example.com');
      expect(result).toBeNull();
    });
  });

  describe('confirmUser', () => {
    it('should confirm user with admin access', async () => {
      const confirmedUser = { ...mockUser, isConfirmed: true };
      userModel.findByIdAndUpdate.mockResolvedValue(confirmedUser);
      const result = await usersService.confirmUser(
        mockUser._id!.toString(),
        mockAdminUser as any,
      );
      expect(result).toEqual(confirmedUser);
    });

    it('should throw ForbiddenException if not admin', async () => {
      const nonAdminUser = { ...mockUser, isAdmin: false };
      await expect(
        usersService.confirmUser(mockUser._id!.toString(), nonAdminUser as any),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException if user not found', async () => {
      userModel.findByIdAndUpdate.mockResolvedValue(null as any);
      await expect(
        usersService.confirmUser(
          mockUser._id!.toString(),
          mockAdminUser as any,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateLastSeen', () => {
    it('should update lastSeen', async () => {
      const lastSeen = new Date();
      userModel.findByIdAndUpdate.mockResolvedValue({} as MockUserDocument);
      await usersService.updateLastSeen(mockUser._id!.toString(), lastSeen);
      expect(userModel.findByIdAndUpdate).toHaveBeenCalledWith(
        mockUser._id!.toString(),
        { lastSeen },
      );
    });
  });

  describe('getOnlineUsers', () => {
    it('should return online users', async () => {
      const onlineUser = { ...mockUser };
      const execMock = jest.fn().mockResolvedValue([onlineUser]);
      userModel.find.mockReturnValue({ exec: execMock } as any);

      const result = await usersService.getOnlineUsers();
      expect(userModel.find).toHaveBeenCalledWith({
        lastSeen: { $gte: expect.any(Date) as unknown as Date },
        isActive: true,
      });
      expect(result).toEqual([onlineUser]);
    });
  });
});
