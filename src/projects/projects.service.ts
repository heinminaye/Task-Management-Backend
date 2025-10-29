import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Project, ProjectDocument } from '../common/schemas/project.schema';
import {
  CreateProjectDto,
  UpdateProjectDto,
  ProjectDto,
  ProjectWithMembersDto,
} from '../common/dtos/project.dto';
import { SocketService } from '../common/services/socket.service';
import { NotificationDto } from '../common/interfaces/socket.interface';

interface PopulatedUser {
  _id: Types.ObjectId;
  email: string;
  name: string;
  createdAt?: Date;
  updatedAt?: Date;
  lastSeen?: Date;
}

interface PopulatedProject
  extends Omit<ProjectDocument, 'createdBy' | 'members'> {
  createdBy: PopulatedUser;
  members: PopulatedUser[];
}

@Injectable()
export class ProjectsService {
  constructor(
    @InjectModel(Project.name) private projectModel: Model<ProjectDocument>,
    private socketService: SocketService,
  ) {}

  private toProjectDto(
    project: ProjectDocument | PopulatedProject,
  ): ProjectDto {
    return {
      id: project._id.toString(),
      name: project.name,
      description: project.description,
      createdBy:
        typeof project.createdBy === 'string' ||
        project.createdBy instanceof Types.ObjectId
          ? project.createdBy.toString()
          : project.createdBy._id.toString(),
      members: (project.members as (Types.ObjectId | PopulatedUser)[]).map(
        (member: Types.ObjectId | PopulatedUser) =>
          member instanceof Types.ObjectId
            ? member.toString()
            : member._id.toString(),
      ),
      isActive: project.isActive,
      createdAt: project.createdAt ?? new Date(),
      updatedAt: project.updatedAt ?? new Date(),
    };
  }

  async create(
    createProjectDto: CreateProjectDto,
    userId: string,
  ): Promise<ProjectDto> {
    const memberIds: Types.ObjectId[] = [
      new Types.ObjectId(userId),
      ...(createProjectDto.members?.map(
        (id: string) => new Types.ObjectId(id),
      ) || []),
    ];

    const project: ProjectDocument = await this.projectModel.create({
      ...createProjectDto,
      createdBy: new Types.ObjectId(userId),
      members: memberIds,
    });

    const projectDto: ProjectDto = this.toProjectDto(project);

    // Notify members about the new project
    const notificationPromises: Promise<void>[] = memberIds.map(
      (memberId: Types.ObjectId) =>
        new Promise<void>((resolve) => {
          if (memberId.toString() !== userId) {
            const notification: NotificationDto = {
              id: new Types.ObjectId().toString(),
              type: 'project_created',
              title: 'New Project',
              message: `You have been added to project: ${createProjectDto.name}`,
              userId: memberId.toString(),
              read: false,
              createdAt: new Date(),
            };
            this.socketService.emitNotification(
              memberId.toString(),
              notification,
            );
          }
          resolve();
        }),
    );
    await Promise.all(notificationPromises);

    return projectDto;
  }

  async update(
    id: string,
    updateProjectDto: UpdateProjectDto,
    userId: string,
  ): Promise<ProjectDto> {
    const project: ProjectDocument | null =
      await this.projectModel.findById(id);

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    // Check if user is a member of the project
    const isMember: boolean = project.members.some(
      (member: Types.ObjectId) => member.toString() === userId,
    );

    if (!isMember) {
      throw new ForbiddenException('Not authorized to update this project');
    }

    const updateData: Partial<Project> = {
      name: updateProjectDto.name,
      description: updateProjectDto.description,
      isActive: updateProjectDto.isActive,
      members: updateProjectDto.members?.map((id) => new Types.ObjectId(id)),
    };

    if (updateProjectDto.members) {
      updateData.members = updateProjectDto.members.map(
        (memberId: string) => new Types.ObjectId(memberId),
      );
    }

    const updatedProject: ProjectDocument | null =
      await this.projectModel.findByIdAndUpdate(id, updateData, { new: true });

    if (!updatedProject) {
      throw new NotFoundException('Project not found after update');
    }

    const projectDto: ProjectDto = this.toProjectDto(updatedProject);

    // Emit real-time event
    this.socketService.emitProjectUpdatedToProject(id, projectDto);

    return projectDto;
  }

  async findAll(userId: string): Promise<ProjectDto[]> {
    const projects: ProjectDocument[] = await this.projectModel
      .find({
        members: new Types.ObjectId(userId),
        isActive: true,
      })
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 })
      .exec();

    return projects.map((project: ProjectDocument) =>
      this.toProjectDto(project),
    );
  }

  async findById(id: string, userId: string): Promise<ProjectWithMembersDto> {
    const project: PopulatedProject | null = (await this.projectModel
      .findById(id)
      .populate('createdBy', 'name email')
      .populate('members', 'name email lastSeen')
      .exec()) as PopulatedProject | null;

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    // Check if user is a member
    const isMember: boolean = project.members.some(
      (member: PopulatedUser) => member._id.toString() === userId,
    );

    if (!isMember) {
      throw new ForbiddenException('Not authorized to access this project');
    }

    const baseDto: ProjectDto = this.toProjectDto(project);

    const memberDetails: Array<{
      id: string;
      email: string;
      name: string;
      isOnline: boolean;
      lastSeen?: Date;
    }> = project.members.map((member: PopulatedUser) => ({
      id: member._id.toString(),
      email: member.email,
      name: member.name,
      isOnline: this.socketService.isUserOnline(member._id.toString()),
      lastSeen: member.lastSeen,
    }));

    return {
      ...baseDto,
      memberDetails,
    };
  }

  async addMember(
    projectId: string,
    userId: string,
    adminUser: { id: string; isAdmin: boolean },
  ): Promise<ProjectDto> {
    if (!adminUser.isAdmin) {
      throw new ForbiddenException('Admin access required');
    }

    const project: ProjectDocument | null =
      await this.projectModel.findById(projectId);

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const userObjectId: Types.ObjectId = new Types.ObjectId(userId);

    const isAlreadyMember: boolean = project.members.some(
      (member: Types.ObjectId) => member.equals(userObjectId),
    );

    if (isAlreadyMember) {
      return this.toProjectDto(project);
    }

    project.members.push(userObjectId);
    await project.save();

    const projectDto: ProjectDto = this.toProjectDto(project);

    // Notify the new member
    const notification: NotificationDto = {
      id: new Types.ObjectId().toString(),
      type: 'project_invite',
      title: 'Project Invitation',
      message: `You have been added to project: ${project.name}`,
      userId: userId,
      read: false,
      createdAt: new Date(),
    };

    this.socketService.emitNotification(userId, notification);

    // Emit project update to all members
    this.socketService.emitProjectUpdatedToProject(projectId, projectDto);

    return projectDto;
  }

  async removeMember(
    projectId: string,
    userId: string,
    currentUserId: string,
  ): Promise<ProjectDto> {
    const project: ProjectDocument | null =
      await this.projectModel.findById(projectId);

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    // Only project creator or admin can remove members
    const isCreator: boolean = project.createdBy.toString() === currentUserId;

    if (!isCreator) {
      throw new ForbiddenException('Only project creator can remove members');
    }

    const userObjectId: Types.ObjectId = new Types.ObjectId(userId);

    project.members = project.members.filter(
      (member: Types.ObjectId) => !member.equals(userObjectId),
    );

    await project.save();

    const projectDto: ProjectDto = this.toProjectDto(project);

    // Emit project update to all members
    this.socketService.emitProjectUpdatedToProject(projectId, projectDto);

    return projectDto;
  }
}
