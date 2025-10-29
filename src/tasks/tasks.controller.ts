import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  Query,
  UsePipes,
  ValidationPipe,
  HttpStatus,
  HttpCode,
  Patch,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TasksService } from './tasks.service';
import { CreateTaskDto, UpdateTaskDto, TaskDto } from '../common/dtos/task.dto';
import type { AuthenticatedRequest } from '../common/interfaces/auth.interface';
import { TaskStatus } from '../common/schemas/task.schema';

interface SearchTasksQuery {
  search?: string;
  projectId?: string;
}

@Controller('tasks')
@UseGuards(JwtAuthGuard)
@UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() createTaskDto: CreateTaskDto,
    @Request() req: AuthenticatedRequest,
  ): Promise<TaskDto> {
    return this.tasksService.create(createTaskDto, req.user.id);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() updateTaskDto: UpdateTaskDto,
    @Request() req: AuthenticatedRequest,
  ): Promise<TaskDto> {
    return this.tasksService.update(id, updateTaskDto, req.user.id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('id') id: string,
    @Request() req: AuthenticatedRequest,
  ): Promise<void> {
    return this.tasksService.remove(id, req.user.id);
  }

  @Get('project/:projectId')
  async findByProject(
    @Param('projectId') projectId: string,
    @Request() req: AuthenticatedRequest,
  ): Promise<TaskDto[]> {
    return this.tasksService.findByProject(projectId, req.user.id);
  }

  @Get('my-tasks')
  async getUserTasks(@Request() req: AuthenticatedRequest): Promise<TaskDto[]> {
    return this.tasksService.getUserTasks(req.user.id);
  }

  @Get('search')
  async searchTasks(
    @Query() query: SearchTasksQuery,
    @Request() req: AuthenticatedRequest,
  ): Promise<TaskDto[]> {
    return this.tasksService.searchTasks(
      req.user.id,
      query.search || '',
      query.projectId,
    );
  }

  @Get(':id')
  async findById(
    @Param('id') id: string,
    @Request() req: AuthenticatedRequest,
  ): Promise<TaskDto> {
    return this.tasksService.findById(id, req.user.id);
  }

  @Patch(':id/status/:status')
  @HttpCode(HttpStatus.OK)
  async updateStatus(
    @Param('id') id: string,
    @Param('status') status: TaskStatus,
    @Request() req: AuthenticatedRequest,
  ): Promise<TaskDto> {
    return this.tasksService.updateStatus(id, status, req.user.id);
  }

  @Get('status/:status')
  async getTasksByStatus(
    @Param('status') status: TaskStatus,
    @Request() req: AuthenticatedRequest,
  ): Promise<TaskDto[]> {
    const userTasks = await this.tasksService.getUserTasks(req.user.id);
    return userTasks.filter((task) => task.status === status);
  }
}
