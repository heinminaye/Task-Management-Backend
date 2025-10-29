import { CommentDto } from '../dtos/comment.dto';
import { ProjectDto } from '../dtos/project.dto';
import { TaskDto } from '../dtos/task.dto';
import { Socket } from 'socket.io';

export interface AuthenticatedSocket extends Socket {
  user: {
    id: string;
    email: string;
    isAdmin: boolean;
  };
}

export interface ServerToClientEvents {
  'task.created': (task: TaskDto) => void;
  'task.updated': (task: TaskDto) => void;
  'task.deleted': (taskId: string) => void;
  'project.updated': (project: ProjectDto) => void;
  'comment.created': (comment: CommentDto) => void;
  'user.online': (user: UserPresenceDto) => void;
  'user.offline': (userId: string) => void;
  notification: (notification: NotificationDto) => void;
}

export interface ClientToServerEvents {
  'join.project': (projectId: string) => void;
  'leave.project': (projectId: string) => void;
  'join.task': (taskId: string) => void;
  'leave.task': (taskId: string) => void;
}

export interface UserPresenceDto {
  userId: string;
  email: string;
  isOnline: boolean;
  lastSeen?: Date;
}

export interface NotificationDto {
  id: string;
  type: string;
  title: string;
  message: string;
  userId: string;
  read: boolean;
  createdAt: Date;
}
