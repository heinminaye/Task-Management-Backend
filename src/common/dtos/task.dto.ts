import {
  IsString,
  IsOptional,
  IsEnum,
  IsDateString,
  IsMongoId,
  Min,
  Max,
} from 'class-validator';
import { TaskStatus } from '../schemas/task.schema';

export class CreateTaskDto {
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsMongoId()
  projectId: string;

  @IsOptional()
  @IsMongoId()
  assignedTo?: string;

  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @Min(0)
  @Max(3)
  priority?: number;
}

export class UpdateTaskDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsMongoId()
  assignedTo?: string;

  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @Min(0)
  @Max(3)
  priority?: number;
}

export class TaskDto {
  id: string;
  title: string;
  description?: string;
  createdBy: string;
  assignedTo?: string;
  projectId: string;
  status: TaskStatus;
  dueDate?: Date;
  priority: number;
  createdAt: Date;
  updatedAt: Date;
}

export class TaskWithDetailsDto extends TaskDto {
  createdByUser?: {
    id: string;
    name: string;
    email: string;
  };
  assignedToUser?: {
    id: string;
    name: string;
    email: string;
  };
  project?: {
    id: string;
    name: string;
  };
}

export class TaskSearchResponseDto {
  tasks: TaskDto[];
  total: number;
  page: number;
  limit: number;
}
