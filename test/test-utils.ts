import { Model } from 'mongoose';
import { getModelToken } from '@nestjs/mongoose';
import * as bcrypt from 'bcryptjs';
import { User, UserDocument } from '../src/common/schemas/user.schema';
import { Task, TaskDocument } from '../src/common/schemas/task.schema';
import { Project, ProjectDocument } from '../src/common/schemas/project.schema';
import { TestUserData } from './types/test-types';

export const createTestUser = async (
  userData: TestUserData,
): Promise<UserDocument> => {
  const userModel: Model<UserDocument> = global.app.get<Model<UserDocument>>(
    getModelToken(User.name),
  );

  const hashedPassword: string = await bcrypt.hash(userData.password, 12);

  return userModel.create({
    email: userData.email,
    password: hashedPassword,
    name: userData.name,
    isActive: userData.isActive ?? true,
    isConfirmed: userData.isConfirmed ?? true,
    isAdmin: userData.isAdmin ?? false,
    lastSeen: new Date(),
  });
};

export const deleteTestUser = async (email: string): Promise<void> => {
  const userModel: Model<UserDocument> = global.app.get<Model<UserDocument>>(
    getModelToken(User.name),
  );
  await userModel.deleteOne({ email });
};

export const createTestProject = async (projectData: {
  name: string;
  description?: string;
  createdBy: string;
  members: string[];
  isActive?: boolean;
}): Promise<ProjectDocument> => {
  const projectModel: Model<ProjectDocument> = global.app.get<
    Model<ProjectDocument>
  >(getModelToken(Project.name));
  return projectModel.create({
    name: projectData.name,
    description: projectData.description,
    createdBy: projectData.createdBy,
    members: projectData.members,
    isActive: projectData.isActive ?? true,
  });
};

export const createTestTask = async (taskData: {
  title: string;
  description?: string;
  createdBy: string;
  projectId: string;
  assignedTo?: string;
  status?: string;
  priority?: number;
  dueDate?: Date;
}): Promise<TaskDocument> => {
  const taskModel: Model<TaskDocument> = global.app.get<Model<TaskDocument>>(
    getModelToken(Task.name),
  );
  return taskModel.create(taskData);
};

export const clearDatabase = async (): Promise<void> => {
  const userModel: Model<UserDocument> = global.app.get<Model<UserDocument>>(
    getModelToken(User.name),
  );
  const taskModel: Model<TaskDocument> = global.app.get<Model<TaskDocument>>(
    getModelToken(Task.name),
  );
  const projectModel: Model<ProjectDocument> = global.app.get<
    Model<ProjectDocument>
  >(getModelToken(Project.name));

  await userModel.deleteMany({});
  await taskModel.deleteMany({});
  await projectModel.deleteMany({});

  console.log('✅ Database cleared');
};
