import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Param,
  Body,
  UseGuards,
  Request,
  Delete,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ProjectsService } from './projects.service';
import {
  CreateProjectDto,
  UpdateProjectDto,
  ProjectDto,
  ProjectWithMembersDto,
} from '../common/dtos/project.dto';
import { AdminUser } from '../common/interfaces/auth.interface';
import { Request as ExpressRequest } from 'express';

interface AuthRequest extends ExpressRequest {
  user: AdminUser;
}

@Controller('projects')
@UseGuards(JwtAuthGuard)
export class ProjectsController {
  constructor(private projectsService: ProjectsService) {}

  // Create a new project
  @Post()
  async create(
    @Body() createProjectDto: CreateProjectDto,
    @Request() req: AuthRequest,
  ): Promise<ProjectDto> {
    return this.projectsService.create(createProjectDto, req.user.id);
  }

  // Update a project (must be a member)
  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() updateProjectDto: UpdateProjectDto,
    @Request() req: AuthRequest,
  ): Promise<ProjectDto> {
    return this.projectsService.update(id, updateProjectDto, req.user.id);
  }

  // List all projects for the current user
  @Get()
  async findAll(@Request() req: AuthRequest): Promise<ProjectDto[]> {
    return this.projectsService.findAll(req.user.id);
  }

  // Get project details including members
  @Get(':id')
  async findById(
    @Param('id') id: string,
    @Request() req: AuthRequest,
  ): Promise<ProjectWithMembersDto> {
    return this.projectsService.findById(id, req.user.id);
  }

  // Add a member to a project (admin-only)
  @Patch(':id/members/:userId')
  async addMember(
    @Param('id') projectId: string,
    @Param('userId') userId: string,
    @Request() req: AuthRequest,
  ): Promise<ProjectDto> {
    return this.projectsService.addMember(projectId, userId, req.user);
  }

  // Remove a member from a project (project creator-only)
  @Delete(':id/members/:userId')
  async removeMember(
    @Param('id') projectId: string,
    @Param('userId') userId: string,
    @Request() req: AuthRequest,
  ): Promise<ProjectDto> {
    return this.projectsService.removeMember(projectId, userId, req.user.id);
  }
}
