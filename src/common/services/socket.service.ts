import { Injectable, Inject, Logger } from '@nestjs/common';
import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import type { Redis } from 'ioredis';
import { createAdapter } from '@socket.io/redis-adapter';
import { UsersService } from '../../users/users.service';
import type {
  AuthenticatedSocket,
  ServerToClientEvents,
  ClientToServerEvents,
  UserPresenceDto,
  NotificationDto,
} from '../interfaces/socket.interface';
import { TaskDto } from '../dtos/task.dto';
import { ProjectDto } from '../dtos/project.dto';
import { CommentDto } from '../dtos/comment.dto';

@WebSocketGateway({
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    credentials: true,
  },
})
@Injectable()
export class SocketService implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  public server!: Server<ClientToServerEvents, ServerToClientEvents>;

  private readonly connectedUsers: Map<string, AuthenticatedSocket> = new Map();
  private readonly logger: Logger = new Logger(SocketService.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly usersService: UsersService,
    @Inject('REDIS_CLIENT') private readonly redisClient: Redis,
  ) {}

  public afterInit(): void {
    const pubClient: Redis = this.redisClient.duplicate();
    const subClient: Redis = this.redisClient.duplicate();
    this.server.adapter(createAdapter(pubClient, subClient));
    this.logger.log('WebSocket Gateway initialized with Redis adapter');
  }

  public async handleConnection(client: Socket): Promise<void> {
    const authToken =
      typeof (client.handshake.auth as { token?: unknown })?.token === 'string'
        ? (client.handshake.auth as { token: string }).token
        : undefined;

    const headerToken =
      typeof (client.handshake.headers as { authorization?: unknown })
        ?.authorization === 'string'
        ? (
            client.handshake.headers as { authorization: string }
          ).authorization.replace('Bearer ', '')
        : undefined;

    const token = authToken || headerToken;

    if (!token) {
      this.logger.warn('Connection rejected: No token provided');
      client.disconnect();
      return;
    }

    // ✅ Separate try/catch JUST for JWT verification
    interface JwtPayload {
      email: string;
      sub: string;
    }

    let payload: JwtPayload;
    try {
      payload = this.jwtService.verify(token);
    } catch {
      // No need to log “Invalid token” unless you want to trace attacks
      client.disconnect();
      return;
    }

    try {
      const user = await this.usersService.findById(payload.sub);
      if (!user) {
        this.logger.warn(
          `Connection rejected: User not found (${payload.sub})`,
        );
        client.disconnect();
        return;
      }

      if (!user.isActive) {
        this.logger.warn(`Connection rejected: Inactive user (${user.email})`);
        client.disconnect();
        return;
      }

      if (!user.isConfirmed) {
        this.logger.warn(
          `Connection rejected: Unconfirmed user (${user.email})`,
        );
        client.disconnect();
        return;
      }

      // ✅ Attach authenticated user
      const authenticatedSocket = client as AuthenticatedSocket;
      authenticatedSocket.user = {
        id: user._id.toString(),
        email: user.email,
        isAdmin: user.isAdmin,
      };

      this.connectedUsers.set(user._id.toString(), authenticatedSocket);

      // Update user presence
      await this.usersService.updateLastSeen(user._id.toString(), new Date());

      // Broadcast online event
      const userPresence: UserPresenceDto = {
        userId: user._id.toString(),
        email: user.email,
        isOnline: true,
        lastSeen: new Date(),
      };

      client.broadcast.emit('user.online', userPresence);

      this.logger.log(`User ${user.email} connected`);
    } catch (error) {
      this.logger.error(
        `[SocketService] Unexpected connection error: ${(error as Error).message}`,
      );
      client.disconnect();
    }
  }

  public async handleDisconnect(client: Socket): Promise<void> {
    const authenticatedClient: AuthenticatedSocket =
      client as AuthenticatedSocket;
    if (authenticatedClient.user) {
      const userId: string = authenticatedClient.user.id;
      this.connectedUsers.delete(userId);
      // Update user last seen
      await this.usersService.updateLastSeen(userId, new Date());

      // Notify others about user going offline
      client.broadcast.emit('user.offline', userId);

      this.logger.log(`User ${authenticatedClient.user.email} disconnected`);
    }
  }

  @SubscribeMessage('join.project')
  public handleJoinProject(
    client: AuthenticatedSocket,
    projectId: string,
  ): void {
    void client.join(`project:${projectId}`);
    this.logger.log(`User ${client.user.email} joined project ${projectId}`);
  }

  @SubscribeMessage('leave.project')
  public handleLeaveProject(
    client: AuthenticatedSocket,
    projectId: string,
  ): void {
    void client.leave(`project:${projectId}`);
    this.logger.log(`User ${client.user.email} left project ${projectId}`);
  }

  @SubscribeMessage('join.task')
  public handleJoinTask(client: AuthenticatedSocket, taskId: string): void {
    void client.join(`task:${taskId}`);
    this.logger.log(`User ${client.user.email} joined task ${taskId}`);
  }

  @SubscribeMessage('leave.task')
  public handleLeaveTask(client: AuthenticatedSocket, taskId: string): void {
    void client.leave(`task:${taskId}`);
    this.logger.log(`User ${client.user.email} left task ${taskId}`);
  }

  // Type-safe event emission methods
  public emitTaskCreated(userId: string, task: TaskDto): void {
    const client = this.connectedUsers.get(userId);
    if (client) {
      client.emit('task.created', task);
    }
  }

  public emitTaskUpdated(userId: string, task: TaskDto): void {
    const client = this.connectedUsers.get(userId);
    if (client) {
      client.emit('task.updated', task);
    }
  }

  public emitTaskDeleted(userId: string, taskId: string): void {
    const client = this.connectedUsers.get(userId);
    if (client) {
      client.emit('task.deleted', taskId);
    }
  }

  public emitProjectUpdated(userId: string, project: ProjectDto): void {
    const client = this.connectedUsers.get(userId);
    if (client) {
      client.emit('project.updated', project);
    }
  }

  public emitCommentCreated(userId: string, comment: CommentDto): void {
    const client = this.connectedUsers.get(userId);
    if (client) {
      client.emit('comment.created', comment);
    }
  }

  public emitUserOnline(userId: string, userPresence: UserPresenceDto): void {
    const client = this.connectedUsers.get(userId);
    if (client) {
      client.emit('user.online', userPresence);
    }
  }

  public emitNotification(userId: string, notification: NotificationDto): void {
    const client = this.connectedUsers.get(userId);
    if (client) {
      client.emit('notification', notification);
    }
  }

  // Room-based type-safe emissions
  public emitTaskCreatedToProject(projectId: string, task: TaskDto): void {
    this.server.to(`project:${projectId}`).emit('task.created', task);
  }

  public emitTaskUpdatedToProject(projectId: string, task: TaskDto): void {
    this.server.to(`project:${projectId}`).emit('task.updated', task);
  }

  public emitTaskDeletedToProject(projectId: string, taskId: string): void {
    this.server.to(`project:${projectId}`).emit('task.deleted', taskId);
  }

  public emitProjectUpdatedToProject(
    projectId: string,
    project: ProjectDto,
  ): void {
    this.server.to(`project:${projectId}`).emit('project.updated', project);
  }

  public emitCommentCreatedToProject(
    projectId: string,
    comment: CommentDto,
  ): void {
    this.server.to(`project:${projectId}`).emit('comment.created', comment);
  }

  public emitUserOnlineToProject(
    projectId: string,
    userPresence: UserPresenceDto,
  ): void {
    this.server.to(`project:${projectId}`).emit('user.online', userPresence);
  }

  public emitNotificationToProject(
    projectId: string,
    notification: NotificationDto,
  ): void {
    this.server.to(`project:${projectId}`).emit('notification', notification);
  }

  // Task room emissions
  public emitTaskUpdatedToTask(taskId: string, task: TaskDto): void {
    this.server.to(`task:${taskId}`).emit('task.updated', task);
  }

  public emitCommentCreatedToTask(taskId: string, comment: CommentDto): void {
    this.server.to(`task:${taskId}`).emit('comment.created', comment);
  }

  // Broadcast methods
  public broadcastUserOnline(userPresence: UserPresenceDto): void {
    this.server.emit('user.online', userPresence);
  }

  public broadcastUserOffline(userId: string): void {
    this.server.emit('user.offline', userId);
  }

  public isUserOnline(userId: string): boolean {
    return this.connectedUsers.has(userId);
  }

  public getConnectedUsers(): string[] {
    return Array.from(this.connectedUsers.keys());
  }

  public getConnectedUserCount(): number {
    return this.connectedUsers.size;
  }
}
