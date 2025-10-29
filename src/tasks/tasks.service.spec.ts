import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { Task, TaskStatus } from '../common/schemas/task.schema';
import { Project } from '../common/schemas/project.schema';
import { SocketService } from '../common/services/socket.service';
import {
  MockTaskModel,
  MockProjectModel,
  MockSocketService,
  MockTaskDocument,
  MockProjectDocument,
} from '../../test/types/test-types';

describe('TasksService', () => {
  let service: TasksService;
  let taskModel: MockTaskModel;
  let projectModel: MockProjectModel;
  let socketService: MockSocketService;

  const mockUserId = '507f1f77bcf86cd799439012';
  const mockProjectId = '507f1f77bcf86cd799439013';
  const mockTaskId = '507f1f77bcf86cd799439014';

  const mockProject: MockProjectDocument = {
    _id: new Types.ObjectId(mockProjectId),
    name: 'Test Project',
    members: [new Types.ObjectId(mockUserId)],
    isActive: true,
  };

  const mockTask: MockTaskDocument = {
    _id: new Types.ObjectId(mockTaskId),
    title: 'Test Task',
    description: 'Test Description',
    createdBy: new Types.ObjectId(mockUserId),
    projectId: new Types.ObjectId(mockProjectId),
    status: TaskStatus.PENDING,
    priority: 1,
    assignedTo: new Types.ObjectId(mockUserId),
    dueDate: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockPopulatedTask = {
    ...mockTask,
    projectId: { ...mockProject },
  };

  beforeEach(async () => {
    const mockTaskModelValue: jest.Mocked<MockTaskModel> = {
      create: jest.fn(),
      find: jest.fn(),
      findById: jest.fn(),
      findByIdAndUpdate: jest.fn(),
      findByIdAndDelete: jest.fn(),
      deleteMany: jest.fn(),
    };

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
        TasksService,
        { provide: getModelToken(Task.name), useValue: mockTaskModelValue },
        {
          provide: getModelToken(Project.name),
          useValue: mockProjectModelValue,
        },
        { provide: SocketService, useValue: mockSocketServiceValue },
      ],
    }).compile();

    service = module.get(TasksService);
    taskModel = module.get(getModelToken(Task.name));
    projectModel = module.get(getModelToken(Project.name));
    socketService = module.get(SocketService);
  });

  afterEach(() => jest.clearAllMocks());

  // -------------------
  // CREATE
  // -------------------
  describe('create', () => {
    it('should create a new task and notify assigned user', async () => {
      const createDto = {
        title: 'New Task',
        description: 'New Description',
        projectId: mockProjectId,
        assignedTo: '507f1f77bcf86cd799439015',
        status: TaskStatus.PENDING,
        priority: 2,
      };

      projectModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockProject),
      } as any);

      taskModel.create.mockResolvedValue({
        ...mockTask,
        title: createDto.title,
        description: createDto.description,
      });

      const result = await service.create(createDto, mockUserId);

      expect(projectModel.findOne).toHaveBeenCalled();
      expect(taskModel.create).toHaveBeenCalled();
      expect(socketService.emitTaskCreatedToProject).toHaveBeenCalled();
      expect(socketService.emitNotification).toHaveBeenCalled();
      expect(result.title).toBe('New Task');
    });

    it('should throw ForbiddenException if user cannot access project', async () => {
      projectModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      } as any);

      await expect(
        service.create({ title: 'Task', projectId: mockProjectId }, mockUserId),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // -------------------
  // UPDATE
  // -------------------
  describe('update', () => {
    it('should update a task if user has access', async () => {
      const updateDto = {
        title: 'Updated Task',
        status: TaskStatus.IN_PROGRESS,
      };

      taskModel.findById.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockPopulatedTask),
      } as any);

      taskModel.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ ...mockTask, ...updateDto }),
      } as any);

      const result = await service.update(mockTaskId, updateDto, mockUserId);

      expect(result.title).toBe('Updated Task');
      expect(socketService.emitTaskUpdatedToProject).toHaveBeenCalled();
    });

    it('should throw NotFoundException if task not found', async () => {
      taskModel.findById.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(null),
      } as any);

      await expect(
        service.update(mockTaskId, { title: 'X' }, mockUserId),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if user has no access', async () => {
      const inaccessibleTask = {
        ...mockPopulatedTask,
        projectId: {
          ...mockPopulatedTask.projectId,
          members: [new Types.ObjectId()],
        },
      };

      taskModel.findById.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(inaccessibleTask),
      } as any);

      await expect(
        service.update(mockTaskId, { title: 'X' }, mockUserId),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // -------------------
  // REMOVE
  // -------------------
  describe('remove', () => {
    it('should remove task if user is creator', async () => {
      (taskModel.findById as jest.Mock).mockResolvedValue(mockTask);

      (taskModel.findByIdAndDelete as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockTask),
      });

      await service.remove(mockTaskId, mockUserId);

      expect(socketService.emitTaskDeletedToProject).toHaveBeenCalled();
    });

    it('should throw NotFoundException if task not found', async () => {
      taskModel.findById.mockResolvedValue(null!);
      await expect(service.remove(mockTaskId, mockUserId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException if user is not creator', async () => {
      const taskNotCreator = {
        ...mockTask,
        createdBy: new Types.ObjectId('507f1f77bcf86cd799439099'),
      };
      (taskModel.findById as jest.Mock).mockResolvedValue(taskNotCreator);

      (taskModel.findByIdAndDelete as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockTask),
      });

      await expect(service.remove(mockTaskId, mockUserId)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  // -------------------
  // FIND BY PROJECT
  // -------------------
  describe('findByProject', () => {
    it('should return tasks if user has access', async () => {
      projectModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockProject),
      } as any);

      taskModel.find.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([mockTask]),
      } as any);

      const result = await service.findByProject(mockProjectId, mockUserId);
      expect(result.length).toBe(1);
    });

    it('should throw ForbiddenException if no access', async () => {
      projectModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      } as any);

      await expect(
        service.findByProject(mockProjectId, mockUserId),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // -------------------
  // FIND BY ID
  // -------------------
  describe('findById', () => {
    it('should return task if user has access', async () => {
      taskModel.findById.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockPopulatedTask),
      } as any);

      const result = await service.findById(mockTaskId, mockUserId);
      expect(result.id).toBe(mockTaskId);
    });

    it('should throw NotFoundException if task not found', async () => {
      taskModel.findById.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(null),
      } as any);

      await expect(service.findById(mockTaskId, mockUserId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException if no access', async () => {
      const inaccessibleTask = {
        ...mockPopulatedTask,
        projectId: {
          ...mockPopulatedTask.projectId,
          members: [new Types.ObjectId()],
        },
      };
      taskModel.findById.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(inaccessibleTask),
      } as any);

      await expect(service.findById(mockTaskId, mockUserId)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  // -------------------
  // UPDATE STATUS
  // -------------------
  describe('updateStatus', () => {
    it('should update status if user is creator', async () => {
      (taskModel.findById as jest.Mock).mockResolvedValue(mockTask);
      (taskModel.findByIdAndUpdate as jest.Mock).mockReturnValue({
        exec: jest
          .fn()
          .mockResolvedValue({ ...mockTask, status: TaskStatus.COMPLETED }),
      });

      const result = await service.updateStatus(
        mockTaskId,
        TaskStatus.COMPLETED,
        mockUserId,
      );
      expect(result.status).toBe(TaskStatus.COMPLETED);
    });

    it('should update status if user is assigned', async () => {
      const assignedTask = {
        ...mockTask,
        createdBy: new Types.ObjectId(),
        assignedTo: new Types.ObjectId(mockUserId),
      };
      (taskModel.findById as jest.Mock).mockResolvedValue(assignedTask);
      (taskModel.findByIdAndUpdate as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          ...assignedTask,
          status: TaskStatus.IN_PROGRESS,
        }),
      });

      const result = await service.updateStatus(
        mockTaskId,
        TaskStatus.IN_PROGRESS,
        mockUserId,
      );
      expect(result.status).toBe(TaskStatus.IN_PROGRESS);
      expect(socketService.emitNotification).toHaveBeenCalled();
    });

    it('should throw NotFoundException if task not found', async () => {
      (taskModel.findById as jest.Mock).mockResolvedValue(null as any);
      await expect(
        service.updateStatus(mockTaskId, TaskStatus.COMPLETED, mockUserId),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if no access', async () => {
      const forbiddenTask = {
        ...mockTask,
        createdBy: new Types.ObjectId(),
        assignedTo: new Types.ObjectId(),
      };
      (taskModel.findById as jest.Mock).mockResolvedValue(forbiddenTask);
      await expect(
        service.updateStatus(mockTaskId, TaskStatus.COMPLETED, mockUserId),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // -------------------
  // GET USER TASKS
  // -------------------
  describe('getUserTasks', () => {
    it('should return user tasks', async () => {
      taskModel.find.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([mockTask]),
      } as any);

      const result = await service.getUserTasks(mockUserId);
      expect(result.length).toBe(1);
      expect(result[0].id).toBe(mockTaskId);
    });
  });

  // -------------------
  // SEARCH TASKS
  // -------------------
  describe('searchTasks', () => {
    it('should return tasks matching search', async () => {
      taskModel.find.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([mockPopulatedTask]),
      } as any);

      const result = await service.searchTasks(mockUserId, 'Test');
      expect(result.length).toBe(1);
    });
  });
});
