import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { Types } from 'mongoose';
import { Server } from 'socket.io';
import { SocketService } from './socket.service';
import { UsersService } from '../../users/users.service';
import type {
  AuthenticatedSocket,
  UserPresenceDto,
  NotificationDto,
} from '../interfaces/socket.interface';
import { TaskDto } from '../dtos/task.dto';
import { ProjectDto } from '../dtos/project.dto';
import { CommentDto } from '../dtos/comment.dto';
import { TaskStatus } from '../schemas/task.schema';

// Mock implementations with complete typing
class MockServer {
  public to = jest.fn().mockReturnThis();
  public emit = jest.fn();
  public adapter = jest.fn();
}

class MockSocket {
  public id = 'test-client-id';
  public handshake = {
    auth: {} as { token?: string },
    headers: {} as { authorization?: string },
    time: new Date().toISOString(),
    address: '127.0.0.1',
    xdomain: false,
    secure: false,
    issued: 0,
    url: '/',
    query: {},
  };
  public user?: { id: string; email: string; isAdmin: boolean };

  public join = jest.fn().mockResolvedValue(undefined);
  public leave = jest.fn().mockResolvedValue(undefined);
  public disconnect = jest.fn().mockReturnThis();
  public broadcast = {
    emit: jest.fn(),
    adapter: {},
    rooms: new Set(),
    exceptRooms: new Set(),
    flags: {},
    compress: jest.fn().mockReturnThis(),
    volatile: jest.fn().mockReturnThis(),
    local: jest.fn().mockReturnThis(),
    timeout: jest.fn().mockReturnThis(),
  };
  public emit = jest.fn();
}

describe('SocketService', () => {
  let socketService: SocketService;
  let jwtService: JwtService;
  let usersService: UsersService;
  let mockServer: MockServer;

  const mockUserId = '507f1f77bcf86cd799439012';
  const mockUser = {
    _id: new Types.ObjectId(mockUserId),
    email: 'test@example.com',
    isActive: true,
    isConfirmed: true,
    isAdmin: false,
  };

  const mockTask: TaskDto = {
    id: 'task123',
    title: 'Test Task',
    description: 'Test Description',
    createdBy: mockUserId,
    projectId: 'project123',
    status: TaskStatus.PENDING,
    priority: 1,
    dueDate: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockProject: ProjectDto = {
    id: 'project123',
    name: 'Test Project',
    description: 'Test Description',
    createdBy: mockUserId,
    members: [mockUserId],
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockComment: CommentDto = {
    id: 'comment123',
    content: 'Test comment',
    taskId: 'task123',
    author: mockUserId,
    projectId: 'project123',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockNotification: NotificationDto = {
    id: 'notif123',
    type: 'task_assigned',
    title: 'New Task',
    message: 'You have a new task',
    userId: mockUserId,
    read: false,
    createdAt: new Date(),
  };

  const mockUserPresence: UserPresenceDto = {
    userId: mockUserId,
    email: mockUser.email,
    isOnline: true,
    lastSeen: new Date(),
  };

  beforeEach(async () => {
    mockServer = new MockServer();

    const mockJwtService = {
      sign: jest.fn(),
      verify: jest.fn(),
      signAsync: jest.fn(),
      verifyAsync: jest.fn(),
      decode: jest.fn(),
    };

    const mockUsersService = {
      findById: jest.fn(),
      updateLastSeen: jest.fn(),
      create: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      findByIdAndUpdate: jest.fn(),
      deleteOne: jest.fn(),
      deleteMany: jest.fn(),
    };

    const mockRedisClient = {
      duplicate: jest.fn().mockReturnValue({}),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SocketService,
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
        {
          provide: 'REDIS_CLIENT',
          useValue: mockRedisClient,
        },
      ],
    }).compile();

    socketService = module.get<SocketService>(SocketService);
    jwtService = module.get(JwtService);
    usersService = module.get(UsersService);

    Object.defineProperty(socketService, 'server', {
      value: mockServer as unknown as Server,
      writable: true,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
    (
      socketService as unknown as {
        connectedUsers: Map<string, AuthenticatedSocket>;
      }
    ).connectedUsers.clear();
  });

  describe('handleConnection', () => {
    it('should authenticate user and establish connection with valid token', async () => {
      const mockClient = new MockSocket();
      mockClient.handshake.auth = { token: 'valid-jwt-token' };

      const verifySpy = jest.spyOn(jwtService, 'verify').mockReturnValue({
        email: mockUser.email,
        sub: mockUserId,
      } as never);

      const findByIdSpy = jest
        .spyOn(usersService, 'findById')
        .mockResolvedValue(mockUser as never);

      const updateLastSeenSpy = jest
        .spyOn(usersService, 'updateLastSeen')
        .mockResolvedValue(undefined as never);

      await socketService.handleConnection(
        mockClient as unknown as AuthenticatedSocket,
      );

      expect(verifySpy).toHaveBeenCalledWith('valid-jwt-token');
      expect(findByIdSpy).toHaveBeenCalledWith(mockUserId);
      expect(updateLastSeenSpy).toHaveBeenCalledWith(
        mockUserId,
        expect.any(Date),
      );
      expect(mockClient.broadcast.emit).toHaveBeenCalledWith(
        'user.online',
        expect.any(Object),
      );
    });

    it('should disconnect client when no token provided', async () => {
      const mockClient = new MockSocket();

      const updateLastSeenSpy = jest.spyOn(usersService, 'updateLastSeen');

      await socketService.handleConnection(
        mockClient as unknown as AuthenticatedSocket,
      );

      expect(mockClient.disconnect).toHaveBeenCalled();
      expect(updateLastSeenSpy).not.toHaveBeenCalled();
    });

    it('should disconnect client when token verification fails', async () => {
      const mockClient = new MockSocket();
      mockClient.handshake.auth = { token: 'invalid-token' };

      const verifySpy = jest
        .spyOn(jwtService, 'verify')
        .mockImplementation(() => {
          throw new Error('Invalid token');
        });

      const updateLastSeenSpy = jest.spyOn(usersService, 'updateLastSeen');

      await socketService.handleConnection(
        mockClient as unknown as AuthenticatedSocket,
      );

      expect(verifySpy).toHaveBeenCalledWith('invalid-token');
      expect(mockClient.disconnect).toHaveBeenCalled();
      expect(updateLastSeenSpy).not.toHaveBeenCalled();
    });

    it('should disconnect client when user not found', async () => {
      const mockClient = new MockSocket();
      mockClient.handshake.auth = { token: 'valid-token' };

      const verifySpy = jest.spyOn(jwtService, 'verify').mockReturnValue({
        email: 'test@example.com',
        sub: 'non-existent-user',
      } as never);

      const findByIdSpy = jest
        .spyOn(usersService, 'findById')
        .mockResolvedValue(null as never);

      const updateLastSeenSpy = jest.spyOn(usersService, 'updateLastSeen');

      await socketService.handleConnection(
        mockClient as unknown as AuthenticatedSocket,
      );

      expect(verifySpy).toHaveBeenCalledWith('valid-token');
      expect(findByIdSpy).toHaveBeenCalledWith('non-existent-user');
      expect(mockClient.disconnect).toHaveBeenCalled();
      expect(updateLastSeenSpy).not.toHaveBeenCalled();
    });

    it('should disconnect client when user is not active', async () => {
      const mockClient = new MockSocket();
      mockClient.handshake.auth = { token: 'valid-token' };

      const inactiveUser = { ...mockUser, isActive: false };

      const verifySpy = jest.spyOn(jwtService, 'verify').mockReturnValue({
        email: mockUser.email,
        sub: mockUserId,
      } as never);

      const findByIdSpy = jest
        .spyOn(usersService, 'findById')
        .mockResolvedValue(inactiveUser as never);

      const updateLastSeenSpy = jest.spyOn(usersService, 'updateLastSeen');

      await socketService.handleConnection(
        mockClient as unknown as AuthenticatedSocket,
      );

      expect(verifySpy).toHaveBeenCalledWith('valid-token');
      expect(findByIdSpy).toHaveBeenCalledWith(mockUserId);
      expect(mockClient.disconnect).toHaveBeenCalled();
      expect(updateLastSeenSpy).not.toHaveBeenCalled();
    });
  });

  describe('handleDisconnect', () => {
    it('should remove user from connected users and notify others', async () => {
      const mockClient = new MockSocket();
      mockClient.user = {
        id: mockUserId,
        email: mockUser.email,
        isAdmin: false,
      };

      const updateLastSeenSpy = jest
        .spyOn(usersService, 'updateLastSeen')
        .mockResolvedValue(undefined as never);

      await socketService.handleDisconnect(
        mockClient as unknown as AuthenticatedSocket,
      );

      expect(updateLastSeenSpy).toHaveBeenCalledWith(
        mockUserId,
        expect.any(Date),
      );
      expect(mockClient.broadcast.emit).toHaveBeenCalledWith(
        'user.offline',
        mockUserId,
      );
    });

    it('should handle disconnect when user is not authenticated', async () => {
      const mockClient = new MockSocket();

      const updateLastSeenSpy = jest.spyOn(usersService, 'updateLastSeen');

      await socketService.handleDisconnect(
        mockClient as unknown as AuthenticatedSocket,
      );

      expect(updateLastSeenSpy).not.toHaveBeenCalled();
      expect(mockClient.broadcast.emit).not.toHaveBeenCalled();
    });
  });

  describe('Room Management', () => {
    it('should handle join project', () => {
      const mockClient = new MockSocket();
      mockClient.user = {
        id: mockUserId,
        email: mockUser.email,
        isAdmin: false,
      };

      socketService.handleJoinProject(
        mockClient as unknown as AuthenticatedSocket,
        'project123',
      );

      expect(mockClient.join).toHaveBeenCalledWith('project:project123');
    });

    it('should handle leave project', () => {
      const mockClient = new MockSocket();
      mockClient.user = {
        id: mockUserId,
        email: mockUser.email,
        isAdmin: false,
      };

      socketService.handleLeaveProject(
        mockClient as unknown as AuthenticatedSocket,
        'project123',
      );

      expect(mockClient.leave).toHaveBeenCalledWith('project:project123');
    });

    it('should handle join task', () => {
      const mockClient = new MockSocket();
      mockClient.user = {
        id: mockUserId,
        email: mockUser.email,
        isAdmin: false,
      };

      socketService.handleJoinTask(
        mockClient as unknown as AuthenticatedSocket,
        'task123',
      );

      expect(mockClient.join).toHaveBeenCalledWith('task:task123');
    });

    it('should handle leave task', () => {
      const mockClient = new MockSocket();
      mockClient.user = {
        id: mockUserId,
        email: mockUser.email,
        isAdmin: false,
      };

      socketService.handleLeaveTask(
        mockClient as unknown as AuthenticatedSocket,
        'task123',
      );

      expect(mockClient.leave).toHaveBeenCalledWith('task:task123');
    });
  });

  describe('User-specific emissions', () => {
    it('should emit task created to specific connected user', () => {
      const mockClient = new MockSocket();
      mockClient.user = {
        id: mockUserId,
        email: mockUser.email,
        isAdmin: false,
      };

      const connectedUsers = (
        socketService as unknown as {
          connectedUsers: Map<string, AuthenticatedSocket>;
        }
      ).connectedUsers;
      connectedUsers.set(
        mockUserId,
        mockClient as unknown as AuthenticatedSocket,
      );

      socketService.emitTaskCreated(mockUserId, mockTask);

      expect(mockClient.emit).toHaveBeenCalledWith('task.created', mockTask);
    });

    it('should emit task updated to specific connected user', () => {
      const mockClient = new MockSocket();
      mockClient.user = {
        id: mockUserId,
        email: mockUser.email,
        isAdmin: false,
      };

      const connectedUsers = (
        socketService as unknown as {
          connectedUsers: Map<string, AuthenticatedSocket>;
        }
      ).connectedUsers;
      connectedUsers.set(
        mockUserId,
        mockClient as unknown as AuthenticatedSocket,
      );

      socketService.emitTaskUpdated(mockUserId, mockTask);

      expect(mockClient.emit).toHaveBeenCalledWith('task.updated', mockTask);
    });

    it('should emit task deleted to specific connected user', () => {
      const mockClient = new MockSocket();
      mockClient.user = {
        id: mockUserId,
        email: mockUser.email,
        isAdmin: false,
      };

      const connectedUsers = (
        socketService as unknown as {
          connectedUsers: Map<string, AuthenticatedSocket>;
        }
      ).connectedUsers;
      connectedUsers.set(
        mockUserId,
        mockClient as unknown as AuthenticatedSocket,
      );

      socketService.emitTaskDeleted(mockUserId, 'task123');

      expect(mockClient.emit).toHaveBeenCalledWith('task.deleted', 'task123');
    });

    it('should emit project updated to specific connected user', () => {
      const mockClient = new MockSocket();
      mockClient.user = {
        id: mockUserId,
        email: mockUser.email,
        isAdmin: false,
      };

      const connectedUsers = (
        socketService as unknown as {
          connectedUsers: Map<string, AuthenticatedSocket>;
        }
      ).connectedUsers;
      connectedUsers.set(
        mockUserId,
        mockClient as unknown as AuthenticatedSocket,
      );

      socketService.emitProjectUpdated(mockUserId, mockProject);

      expect(mockClient.emit).toHaveBeenCalledWith(
        'project.updated',
        mockProject,
      );
    });

    it('should emit comment created to specific connected user', () => {
      const mockClient = new MockSocket();
      mockClient.user = {
        id: mockUserId,
        email: mockUser.email,
        isAdmin: false,
      };

      const connectedUsers = (
        socketService as unknown as {
          connectedUsers: Map<string, AuthenticatedSocket>;
        }
      ).connectedUsers;
      connectedUsers.set(
        mockUserId,
        mockClient as unknown as AuthenticatedSocket,
      );

      socketService.emitCommentCreated(mockUserId, mockComment);

      expect(mockClient.emit).toHaveBeenCalledWith(
        'comment.created',
        mockComment,
      );
    });

    it('should emit user online to specific connected user', () => {
      const mockClient = new MockSocket();
      mockClient.user = {
        id: mockUserId,
        email: mockUser.email,
        isAdmin: false,
      };

      const connectedUsers = (
        socketService as unknown as {
          connectedUsers: Map<string, AuthenticatedSocket>;
        }
      ).connectedUsers;
      connectedUsers.set(
        mockUserId,
        mockClient as unknown as AuthenticatedSocket,
      );

      socketService.emitUserOnline(mockUserId, mockUserPresence);

      expect(mockClient.emit).toHaveBeenCalledWith(
        'user.online',
        mockUserPresence,
      );
    });

    it('should emit notification to specific connected user', () => {
      const mockClient = new MockSocket();
      mockClient.user = {
        id: mockUserId,
        email: mockUser.email,
        isAdmin: false,
      };

      const connectedUsers = (
        socketService as unknown as {
          connectedUsers: Map<string, AuthenticatedSocket>;
        }
      ).connectedUsers;
      connectedUsers.set(
        mockUserId,
        mockClient as unknown as AuthenticatedSocket,
      );

      socketService.emitNotification(mockUserId, mockNotification);

      expect(mockClient.emit).toHaveBeenCalledWith(
        'notification',
        mockNotification,
      );
    });

    it('should not emit to non-connected user', () => {
      socketService.emitTaskCreated('non-existent-user', mockTask);

      expect(mockServer.emit).not.toHaveBeenCalled();
    });
  });

  describe('Room-based emissions', () => {
    it('should emit task created to project room', () => {
      socketService.emitTaskCreatedToProject('project123', mockTask);

      expect(mockServer.to).toHaveBeenCalledWith('project:project123');
      expect(mockServer.emit).toHaveBeenCalledWith('task.created', mockTask);
    });

    it('should emit task updated to project room', () => {
      socketService.emitTaskUpdatedToProject('project123', mockTask);

      expect(mockServer.to).toHaveBeenCalledWith('project:project123');
      expect(mockServer.emit).toHaveBeenCalledWith('task.updated', mockTask);
    });

    it('should emit task deleted to project room', () => {
      socketService.emitTaskDeletedToProject('project123', 'task123');

      expect(mockServer.to).toHaveBeenCalledWith('project:project123');
      expect(mockServer.emit).toHaveBeenCalledWith('task.deleted', 'task123');
    });

    it('should emit project updated to project room', () => {
      socketService.emitProjectUpdatedToProject('project123', mockProject);

      expect(mockServer.to).toHaveBeenCalledWith('project:project123');
      expect(mockServer.emit).toHaveBeenCalledWith(
        'project.updated',
        mockProject,
      );
    });

    it('should emit comment created to project room', () => {
      socketService.emitCommentCreatedToProject('project123', mockComment);

      expect(mockServer.to).toHaveBeenCalledWith('project:project123');
      expect(mockServer.emit).toHaveBeenCalledWith(
        'comment.created',
        mockComment,
      );
    });

    it('should emit user online to project room', () => {
      socketService.emitUserOnlineToProject('project123', mockUserPresence);

      expect(mockServer.to).toHaveBeenCalledWith('project:project123');
      expect(mockServer.emit).toHaveBeenCalledWith(
        'user.online',
        mockUserPresence,
      );
    });

    it('should emit notification to project room', () => {
      socketService.emitNotificationToProject('project123', mockNotification);

      expect(mockServer.to).toHaveBeenCalledWith('project:project123');
      expect(mockServer.emit).toHaveBeenCalledWith(
        'notification',
        mockNotification,
      );
    });
  });

  describe('Task room emissions', () => {
    it('should emit task updated to task room', () => {
      socketService.emitTaskUpdatedToTask('task123', mockTask);

      expect(mockServer.to).toHaveBeenCalledWith('task:task123');
      expect(mockServer.emit).toHaveBeenCalledWith('task.updated', mockTask);
    });

    it('should emit comment created to task room', () => {
      socketService.emitCommentCreatedToTask('task123', mockComment);

      expect(mockServer.to).toHaveBeenCalledWith('task:task123');
      expect(mockServer.emit).toHaveBeenCalledWith(
        'comment.created',
        mockComment,
      );
    });
  });

  describe('Broadcast methods', () => {
    it('should broadcast user online to all clients', () => {
      socketService.broadcastUserOnline(mockUserPresence);

      expect(mockServer.emit).toHaveBeenCalledWith(
        'user.online',
        mockUserPresence,
      );
    });

    it('should broadcast user offline to all clients', () => {
      socketService.broadcastUserOffline(mockUserId);

      expect(mockServer.emit).toHaveBeenCalledWith('user.offline', mockUserId);
    });
  });

  describe('Utility methods', () => {
    it('should check if user is online', () => {
      const mockClient = new MockSocket();
      mockClient.user = {
        id: mockUserId,
        email: mockUser.email,
        isAdmin: false,
      };

      const connectedUsers = (
        socketService as unknown as {
          connectedUsers: Map<string, AuthenticatedSocket>;
        }
      ).connectedUsers;
      connectedUsers.set(
        mockUserId,
        mockClient as unknown as AuthenticatedSocket,
      );

      expect(socketService.isUserOnline(mockUserId)).toBe(true);
      expect(socketService.isUserOnline('non-existent-user')).toBe(false);
    });

    it('should get connected users', () => {
      const mockClient = new MockSocket();
      mockClient.user = {
        id: mockUserId,
        email: mockUser.email,
        isAdmin: false,
      };

      const connectedUsers = (
        socketService as unknown as {
          connectedUsers: Map<string, AuthenticatedSocket>;
        }
      ).connectedUsers;
      connectedUsers.set(
        mockUserId,
        mockClient as unknown as AuthenticatedSocket,
      );

      const result = socketService.getConnectedUsers();
      expect(result).toEqual([mockUserId]);
    });

    it('should get connected user count', () => {
      const mockClient = new MockSocket();
      mockClient.user = {
        id: mockUserId,
        email: mockUser.email,
        isAdmin: false,
      };

      const connectedUsers = (
        socketService as unknown as {
          connectedUsers: Map<string, AuthenticatedSocket>;
        }
      ).connectedUsers;
      connectedUsers.set(
        mockUserId,
        mockClient as unknown as AuthenticatedSocket,
      );

      expect(socketService.getConnectedUserCount()).toBe(1);
    });

    it('should return empty array when no users connected', () => {
      const result = socketService.getConnectedUsers();
      expect(result).toEqual([]);
    });

    it('should return zero when no users connected', () => {
      expect(socketService.getConnectedUserCount()).toBe(0);
    });
  });
});
