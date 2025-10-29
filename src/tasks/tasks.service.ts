import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Task, TaskDocument, TaskStatus } from '../common/schemas/task.schema';
import { Project, ProjectDocument } from '../common/schemas/project.schema';
import { CreateTaskDto, UpdateTaskDto, TaskDto } from '../common/dtos/task.dto';
import { SocketService } from '../common/services/socket.service';
import type { NotificationDto } from '../common/interfaces/socket.interface';

interface ProjectInfo {
  _id: Types.ObjectId;
  name: string;
  members: Types.ObjectId[];
}

interface PopulatedProject {
  _id: Types.ObjectId;
  name: string;
  members: Types.ObjectId[];
}

interface PopulatedTask extends Omit<TaskDocument, 'projectId'> {
  projectId: PopulatedProject;
}

@Injectable()
export class TasksService {
  constructor(
    @InjectModel(Task.name) private readonly taskModel: Model<TaskDocument>,
    @InjectModel(Project.name)
    private readonly projectModel: Model<ProjectDocument>,
    private readonly socketService: SocketService,
  ) {}

  private toTaskDto(task: TaskDocument | PopulatedTask): TaskDto {
    return {
      id: task._id.toString(),
      title: task.title,
      description: task.description,
      createdBy: task.createdBy?.toString(),
      assignedTo: task.assignedTo?.toString(),
      projectId:
        typeof task.projectId === 'object' && 'name' in task.projectId
          ? task.projectId._id.toString()
          : task.projectId.toString(),
      status: task.status,
      dueDate: task.dueDate,
      priority: task.priority,
      createdAt: task.createdAt ?? new Date(),
      updatedAt: task.updatedAt ?? new Date(),
    };
  }

  async create(createTaskDto: CreateTaskDto, userId: string): Promise<TaskDto> {
    const project = await this.validateProjectAccess(
      createTaskDto.projectId,
      userId,
    );

    const taskData: Partial<Task> = {
      title: createTaskDto.title,
      description: createTaskDto.description,
      createdBy: new Types.ObjectId(userId),
      projectId: new Types.ObjectId(createTaskDto.projectId),
      status: createTaskDto.status || TaskStatus.PENDING,
      priority: createTaskDto.priority || 0,
      assignedTo: createTaskDto.assignedTo
        ? new Types.ObjectId(createTaskDto.assignedTo)
        : undefined,
      dueDate: createTaskDto.dueDate
        ? new Date(createTaskDto.dueDate)
        : undefined,
    };

    const task = await this.taskModel.create(taskData);
    const taskDto = this.toTaskDto(task);

    this.socketService.emitTaskCreatedToProject(
      createTaskDto.projectId,
      taskDto,
    );

    if (createTaskDto.assignedTo && createTaskDto.assignedTo !== userId) {
      const notification: NotificationDto = {
        id: new Types.ObjectId().toString(),
        type: 'task_assigned',
        title: 'New Task Assigned',
        message: `You have been assigned to "${createTaskDto.title}" in project: ${project.name}`,
        userId: createTaskDto.assignedTo,
        read: false,
        createdAt: new Date(),
      };
      this.socketService.emitNotification(
        createTaskDto.assignedTo,
        notification,
      );
    }

    return taskDto;
  }

  async update(
    id: string,
    dto: UpdateTaskDto,
    userId: string,
  ): Promise<TaskDto> {
    const task = (await this.taskModel
      .findById(id)
      .populate<{ projectId: PopulatedProject }>('projectId', 'name members')
      .exec()) as PopulatedTask | null;

    if (!task) throw new NotFoundException('Task not found');
    const hasAccess = await this.checkTaskAccess(task, userId);
    if (!hasAccess)
      throw new ForbiddenException('Not authorized to update this task');

    const updateData: Partial<Task> = {};
    if (dto.title !== undefined) updateData.title = dto.title;
    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.status !== undefined) updateData.status = dto.status;
    if (dto.priority !== undefined) updateData.priority = dto.priority;
    if (dto.dueDate !== undefined) updateData.dueDate = new Date(dto.dueDate);
    if (dto.assignedTo !== undefined)
      updateData.assignedTo = dto.assignedTo
        ? new Types.ObjectId(dto.assignedTo)
        : undefined;

    const oldAssignedTo = task.assignedTo?.toString();
    const updatedTask = await this.taskModel
      .findByIdAndUpdate(id, updateData, { new: true })
      .exec();
    if (!updatedTask)
      throw new NotFoundException('Task not found after update');

    const taskDto = this.toTaskDto(updatedTask);

    this.socketService.emitTaskUpdatedToProject(
      task.projectId._id.toString(),
      taskDto,
    );

    if (dto.assignedTo && dto.assignedTo !== oldAssignedTo) {
      const notification: NotificationDto = {
        id: new Types.ObjectId().toString(),
        type: 'task_assigned',
        title: 'Task Assigned to You',
        message: `You have been assigned to "${task.title}" in project: ${task.projectId.name}`,
        userId: dto.assignedTo,
        read: false,
        createdAt: new Date(),
      };
      this.socketService.emitNotification(dto.assignedTo, notification);
    }

    return taskDto;
  }

  async remove(id: string, userId: string): Promise<void> {
    const task = await this.taskModel.findById(id);
    if (!task) throw new NotFoundException('Task not found');
    if (task.createdBy.toString() !== userId)
      throw new ForbiddenException('Not authorized to delete this task');

    await this.taskModel.findByIdAndDelete(id).exec();
    this.socketService.emitTaskDeletedToProject(task.projectId.toString(), id);
  }

  async findByProject(projectId: string, userId: string): Promise<TaskDto[]> {
    await this.validateProjectAccess(projectId, userId);
    const tasks = await this.taskModel
      .find({ projectId: new Types.ObjectId(projectId) })
      .populate('createdBy', 'name email')
      .populate('assignedTo', 'name email')
      .sort({ createdAt: -1 })
      .exec();

    return tasks.map((task) => this.toTaskDto(task));
  }

  /** ✅ Find Single Task */
  async findById(id: string, userId: string): Promise<TaskDto> {
    const task = (await this.taskModel
      .findById(id)
      .populate('createdBy', 'name email')
      .populate('assignedTo', 'name email')
      .populate<{ projectId: PopulatedProject }>('projectId', 'name members')
      .exec()) as PopulatedTask | null;

    if (!task) throw new NotFoundException('Task not found');
    const hasAccess = await this.checkTaskAccess(task, userId);
    if (!hasAccess)
      throw new ForbiddenException('Not authorized to access this task');

    return this.toTaskDto(task);
  }

  /** ✅ Update Only Status */
  async updateStatus(
    id: string,
    status: TaskStatus,
    userId: string,
  ): Promise<TaskDto> {
    const task = await this.taskModel.findById(id);
    if (!task) throw new NotFoundException('Task not found');

    const isCreator = task.createdBy.toString() === userId;
    const isAssigned = task.assignedTo?.toString() === userId;
    if (!isCreator && !isAssigned)
      throw new ForbiddenException('Not authorized to update this task');

    const updatedTask = await this.taskModel
      .findByIdAndUpdate(id, { status }, { new: true })
      .exec();
    if (!updatedTask)
      throw new NotFoundException('Task not found after status update');

    const taskDto = this.toTaskDto(updatedTask);
    this.socketService.emitTaskUpdatedToProject(
      task.projectId.toString(),
      taskDto,
    );

    if (!isCreator) {
      const notification: NotificationDto = {
        id: new Types.ObjectId().toString(),
        type: 'task_status_changed',
        title: 'Task Status Updated',
        message: `Task "${task.title}" status changed to ${status}`,
        userId: task.createdBy.toString(),
        read: false,
        createdAt: new Date(),
      };
      this.socketService.emitNotification(
        task.createdBy.toString(),
        notification,
      );
    }

    return taskDto;
  }

  /** ✅ User’s All Tasks */
  async getUserTasks(userId: string): Promise<TaskDto[]> {
    const tasks = await this.taskModel
      .find({
        $or: [
          { createdBy: new Types.ObjectId(userId) },
          { assignedTo: new Types.ObjectId(userId) },
        ],
      })
      .populate('createdBy', 'name email')
      .populate('assignedTo', 'name email')
      .populate('projectId', 'name')
      .sort({ createdAt: -1 })
      .exec();

    return tasks.map((task) => this.toTaskDto(task));
  }

  /** ✅ Search Tasks */
  async searchTasks(
    userId: string,
    search: string,
    projectId?: string,
  ): Promise<TaskDto[]> {
    const searchFilter: Record<string, any> = {
      $or: [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ],
    };
    if (projectId) searchFilter.projectId = new Types.ObjectId(projectId);

    const tasks = (await this.taskModel
      .find(searchFilter)
      .populate<{ projectId: PopulatedProject }>('projectId', 'name members')
      .exec()) as PopulatedTask[];

    const accessibleTasks: PopulatedTask[] = [];
    for (const task of tasks) {
      const hasAccess = await this.checkTaskAccess(task, userId);
      if (hasAccess) accessibleTasks.push(task);
    }

    return accessibleTasks.map((task) => this.toTaskDto(task));
  }

  /** ✅ Project Access Validation */
  private async validateProjectAccess(
    projectId: string,
    userId: string,
  ): Promise<ProjectInfo> {
    const project = await this.projectModel
      .findOne({
        _id: new Types.ObjectId(projectId),
        members: new Types.ObjectId(userId),
        isActive: true,
      })
      .exec();

    if (!project)
      throw new ForbiddenException('Project not found or access denied');

    return { _id: project._id, name: project.name, members: project.members };
  }

  /** ✅ Access Checker */
  private async checkTaskAccess(
    task: PopulatedTask | TaskDocument,
    userId: string,
  ): Promise<boolean> {
    await Promise.resolve(); // prevent "async without await" lint warning
    if (
      'projectId' in task &&
      typeof task.projectId === 'object' &&
      task.projectId !== null
    ) {
      const populatedTask = task as PopulatedTask;
      return populatedTask.projectId.members.some(
        (member: Types.ObjectId) => member.toString() === userId,
      );
    }

    const regularTask = task as TaskDocument;
    return (
      regularTask.createdBy.toString() === userId ||
      regularTask.assignedTo?.toString() === userId
    );
  }
}
