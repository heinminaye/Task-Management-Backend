import { Types } from 'mongoose';
import { UserDocument } from '../../src/common/schemas/user.schema';
import { TaskDocument } from '../../src/common/schemas/task.schema';
import { ProjectDocument } from '../../src/common/schemas/project.schema';

/**
 * Flexible mock document type:
 * - Allows partial documents
 * - _id can be string (mock) or Types.ObjectId (real)
 */
export type MockUserDocument = Partial<UserDocument> & {
  _id?: string | Types.ObjectId;
};
export type MockTaskDocument = Partial<TaskDocument> & {
  _id?: string | Types.ObjectId;
};
export type MockProjectDocument = Partial<ProjectDocument> & {
  _id?: string | Types.ObjectId;
};

/**
 * Mock Mongoose model for User
 */
export interface MockUserModel {
  findOne: jest.Mock<Promise<MockUserDocument | null>, [filter?: any]>;
  create: jest.Mock<Promise<MockUserDocument>, [data: any]>;
  find: jest.Mock<
    { exec: jest.Mock<Promise<MockUserDocument[]>, []> },
    [filter?: any]
  >;
  findById: jest.Mock<
    Promise<MockUserDocument | null>,
    [id: string | Types.ObjectId]
  >;
  findByIdAndUpdate: jest.Mock<
    Promise<MockUserDocument>,
    [id: string | Types.ObjectId, update: any, options?: any]
  >;
  deleteOne: jest.Mock<Promise<any>, [filter: any]>;
  deleteMany: jest.Mock<Promise<any>, [filter?: any]>;
}

/**
 * Mock Mongoose model for Task
 */
export interface MockTaskModel {
  create: jest.Mock<Promise<MockTaskDocument>, [Partial<TaskDocument>]>;

  // find returns a query with exec()
  find: jest.Mock<
    { exec: jest.Mock<Promise<MockTaskDocument[]>, []> },
    [filter?: any]
  >;

  // findById can be chained with populate().exec()
  findById: jest.Mock<
    {
      populate: jest.Mock<
        {
          exec: jest.Mock<Promise<MockTaskDocument | null>, []>;
        },
        [string, string?]
      >;
      exec: jest.Mock<Promise<MockTaskDocument | null>, []>;
    },
    [string | Types.ObjectId]
  >;

  findByIdAndUpdate: jest.Mock<
    { exec: jest.Mock<Promise<MockTaskDocument>, []> },
    [id: string | Types.ObjectId, update: any, options?: any]
  >;

  findByIdAndDelete: jest.Mock<
    { exec: jest.Mock<Promise<MockTaskDocument | null>, []> },
    [id: string | Types.ObjectId]
  >;

  deleteMany: jest.Mock<Promise<any>, [filter?: any]>;
}
/**
 * Mock Mongoose model for Project
 */
export interface MockProjectModel {
  findOne: jest.Mock<Promise<MockProjectDocument | null>, [filter?: any]>;
  create: jest.Mock<Promise<MockProjectDocument>, [data: any]>;
  deleteMany: jest.Mock<Promise<any>, [filter?: any]>;
  find: jest.Mock<
    { exec: jest.Mock<Promise<MockProjectDocument[]>, []> },
    [filter?: any]
  >;
  findById: jest.Mock<
    Promise<MockProjectDocument | null>,
    [id: string | Types.ObjectId]
  >;
  findByIdAndUpdate: jest.Mock<
    Promise<MockProjectDocument>,
    [id: string | Types.ObjectId, update: any, options?: any]
  >;
}

/**
 * Mock JWT service
 */
export interface MockJwtService {
  sign: jest.Mock<string, [payload: any]>;
  verify: jest.Mock<any, [token: string]>;
}

/**
 * Mock Socket service for emitting events
 */
export interface MockSocketService {
  broadcastUserOnline: jest.Mock<void, [userPresence: any]>;
  broadcastUserOffline: jest.Mock<void, [userId: string]>;
  isUserOnline: jest.Mock<boolean, [userId: string]>;
  getConnectedUsers: jest.Mock<string[], []>;
  getConnectedUserCount: jest.Mock<number, []>;
  handleJoinProject: jest.Mock<void, [client: any, projectId: string]>;
  handleLeaveProject: jest.Mock<void, [client: any, projectId: string]>;
  handleJoinTask: jest.Mock<void, [client: any, taskId: string]>;
  handleLeaveTask: jest.Mock<void, [client: any, taskId: string]>;
  emitTaskCreatedToProject: jest.Mock<void, [projectId: string, task: any]>;
  emitTaskUpdatedToProject: jest.Mock<void, [projectId: string, task: any]>;
  emitTaskDeletedToProject: jest.Mock<
    void,
    [projectId: string, taskId: string]
  >;
  emitProjectUpdatedToProject: jest.Mock<
    void,
    [projectId: string, project: any]
  >;
  emitCommentCreatedToProject: jest.Mock<
    void,
    [projectId: string, comment: any]
  >;
  emitUserOnlineToProject: jest.Mock<
    void,
    [projectId: string, userPresence: any]
  >;
  emitNotificationToProject: jest.Mock<
    void,
    [projectId: string, notification: any]
  >;
  emitTaskUpdatedToTask: jest.Mock<void, [taskId: string, task: any]>;
  emitCommentCreatedToTask: jest.Mock<void, [taskId: string, comment: any]>;
  emitNotification: jest.Mock<void, [userId: string, notification: any]>;
}

/**
 * Simple test user data
 */
export interface TestUserData {
  email: string;
  password: string;
  name: string;
  isActive?: boolean;
  isConfirmed?: boolean;
  isAdmin?: boolean;
}

/**
 * Auth response tokens structure
 */
export interface AuthTokens {
  accessToken: string;
  user: {
    id: string | Types.ObjectId;
    email: string;
    name: string;
    isAdmin: boolean;
    isConfirmed: boolean;
  };
}

/**
 * Global test application type
 */
export interface TestApp {
  get: <T>(token: string | symbol | (new (...args: any[]) => T)) => T;
  close: () => Promise<void>;
}

/**
 * Declare a global test app variable for convenience
 */
declare global {
  // eslint-disable-next-line no-var
  var app: TestApp;
}
