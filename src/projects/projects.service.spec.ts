import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { Project } from '../common/schemas/project.schema';
import {
  MockProjectModel,
  MockSocketService,
  MockProjectDocument,
} from '../../test/types/test-types';
import { SocketService } from '../common/services/socket.service';

describe('ProjectsService', () => {
  let projectsService: ProjectsService;
  let projectModel: jest.Mocked<MockProjectModel>;
  let socketService: jest.Mocked<MockSocketService>;

  const mockProject: MockProjectDocument = {
    _id: new Types.ObjectId('507f1f77bcf86cd799439011'),
    name: 'Test Project',
    description: 'A test project',
    createdBy: new Types.ObjectId('507f1f77bcf86cd799439012'),
    members: [new Types.ObjectId('507f1f77bcf86cd799439012')],
    isActive: true,
    save: jest.fn(),
  };

  beforeEach(async () => {
    const mockProjectModelValue: jest.Mocked<MockProjectModel> = {
      findOne: jest.fn(),
      create: jest.fn(),
      deleteMany: jest.fn(),
      find: jest.fn(),
      findById: jest.fn(),
      findByIdAndUpdate: jest.fn(),
    };

    const mockSocketServiceValue: jest.Mocked<MockSocketService> = {
      broadcastUserOnline: jest.fn(),
      broadcastUserOffline: jest.fn(),
      isUserOnline: jest.fn(),
      getConnectedUsers: jest.fn(),
      getConnectedUserCount: jest.fn(),
      handleJoinProject: jest.fn(),
      handleLeaveProject: jest.fn(),
      handleJoinTask: jest.fn(),
      handleLeaveTask: jest.fn(),
      emitTaskCreatedToProject: jest.fn(),
      emitTaskUpdatedToProject: jest.fn(),
      emitTaskDeletedToProject: jest.fn(),
      emitNotification: jest.fn(),
      emitProjectUpdatedToProject: jest.fn(),
      emitCommentCreatedToProject: jest.fn(),
      emitUserOnlineToProject: jest.fn(),
      emitNotificationToProject: jest.fn(),
      emitTaskUpdatedToTask: jest.fn(),
      emitCommentCreatedToTask: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectsService,
        {
          provide: getModelToken(Project.name),
          useValue: mockProjectModelValue,
        },
        { provide: SocketService, useValue: mockSocketServiceValue },
      ],
    }).compile();

    projectsService = module.get<ProjectsService>(ProjectsService);
    projectModel = module.get(getModelToken(Project.name));
    socketService = module.get(SocketService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // -------------------
  // ✅ CREATE
  // -------------------
  describe('create', () => {
    it('should create a new project and notify members', async () => {
      const dto = { name: 'New Project', description: 'Desc', members: [] };
      const createdProject = {
        ...mockProject,
        name: dto.name,
        description: dto.description,
        _id: new Types.ObjectId(),
      };

      projectModel.create.mockResolvedValue(createdProject as any);

      const result = await projectsService.create(
        dto as any,
        '507f1f77bcf86cd799439012',
      );

      expect(projectModel.create).toHaveBeenCalled();
      // No notifications for self-only project
      expect(socketService.emitNotification).not.toHaveBeenCalled();
      expect(result.name).toBe('New Project');
    });
  });

  // -------------------
  // ✅ UPDATE
  // -------------------
  describe('update', () => {
    it('should update project if user is member', async () => {
      const updated = { ...mockProject, name: 'Updated Project' };
      projectModel.findById.mockResolvedValue(mockProject as any);
      projectModel.findByIdAndUpdate.mockResolvedValue(updated as any);

      const result = await projectsService.update(
        mockProject._id!.toString(),
        { name: 'Updated Project' } as any,
        mockProject.createdBy!.toString(),
      );

      expect(result.name).toBe('Updated Project');
      expect(socketService.emitProjectUpdatedToProject).toHaveBeenCalled();
    });

    it('should throw if not a member', async () => {
      projectModel.findById.mockResolvedValue(mockProject as any);

      await expect(
        projectsService.update(
          mockProject._id!.toString(),
          { name: 'x' } as any,
          'nonmember',
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw if project not found', async () => {
      projectModel.findById.mockResolvedValue(null);

      await expect(
        projectsService.update('invalid-id', { name: 'x' } as any, 'user'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // -------------------
  // ✅ FIND ALL
  // -------------------
  describe('findAll', () => {
    it('should return all user projects', async () => {
      const execMock = jest.fn().mockResolvedValue([mockProject]);
      projectModel.find.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        exec: execMock,
      } as any);

      const result = await projectsService.findAll('507f1f77bcf86cd799439012');
      expect(result.length).toBe(1);
      expect(result[0].name).toBe('Test Project');
    });
  });

  // -------------------
  // ✅ FIND BY ID
  // -------------------
  describe('findById', () => {
    it('should return project if user is member', async () => {
      const populatedProject = {
        ...mockProject,
        members: [
          {
            _id: new Types.ObjectId('507f1f77bcf86cd799439012'),
            email: 'a@a.com',
            name: 'User',
          },
        ],
        createdBy: {
          _id: new Types.ObjectId(),
          email: 'b@b.com',
          name: 'Creator',
        },
      };
      projectModel.findById.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(populatedProject),
      } as any);

      socketService.isUserOnline.mockReturnValue(true);

      const result = await projectsService.findById(
        mockProject._id!.toString(),
        '507f1f77bcf86cd799439012',
      );
      expect(result.memberDetails[0].isOnline).toBe(true);
    });

    it('should throw if project not found', async () => {
      projectModel.findById.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(null),
      } as any);

      await expect(
        projectsService.findById('invalid', '507f1f77bcf86cd799439012'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw if user is not a member', async () => {
      const populatedProject = { ...mockProject, members: [] };
      projectModel.findById.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(populatedProject),
      } as any);

      await expect(
        projectsService.findById(mockProject._id!.toString(), 'nonmember'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // -------------------
  // ✅ ADD MEMBER
  // -------------------
  describe('addMember', () => {
    it('should add a member if admin', async () => {
      const newMember = new Types.ObjectId('507f1f77bcf86cd799439013');
      const projectWithMember = {
        ...mockProject,
        members: [],
        save: jest.fn(),
      };
      projectModel.findById.mockResolvedValue(projectWithMember as any);

      const result = await projectsService.addMember(
        projectWithMember._id!.toString(),
        newMember.toString(),
        { id: 'admin', isAdmin: true },
      );

      expect(socketService.emitNotification).toHaveBeenCalled();
      expect(socketService.emitProjectUpdatedToProject).toHaveBeenCalled();
      expect(result.members).toBeDefined();
    });

    it('should throw if not admin', async () => {
      await expect(
        projectsService.addMember('p1', 'u1', { id: 'user', isAdmin: false }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw if project not found', async () => {
      projectModel.findById.mockResolvedValue(null);

      await expect(
        projectsService.addMember('p1', 'u1', { id: 'admin', isAdmin: true }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // -------------------
  // ✅ REMOVE MEMBER
  // -------------------
  describe('removeMember', () => {
    it('should remove a member if creator', async () => {
      const project = {
        ...mockProject,
        createdBy: new Types.ObjectId('507f191e810c19729de860ea'),
        members: [new Types.ObjectId('507f191e810c19729de860eb')],
        save: jest.fn(),
      };
      projectModel.findById.mockResolvedValue(project as any);

      const result = await projectsService.removeMember(
        'pid',
        '507f191e810c19729de860eb',
        '507f191e810c19729de860ea',
      );
      expect(socketService.emitProjectUpdatedToProject).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should throw if not creator', async () => {
      const project = {
        ...mockProject,
        createdBy: new Types.ObjectId('507f191e810c19729de860ea'),
      };
      projectModel.findById.mockResolvedValue(project as any);

      await expect(
        projectsService.removeMember(
          'pid',
          '507f191e810c19729de860eb',
          '507f191e810c19729de860ec',
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw if project not found', async () => {
      projectModel.findById.mockResolvedValue(null);

      await expect(
        projectsService.removeMember(
          'pid',
          '507f191e810c19729de860eb',
          '507f191e810c19729de860ea',
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
