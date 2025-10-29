import {
  IsString,
  IsOptional,
  IsBoolean,
  IsArray,
  IsMongoId,
  MinLength,
  MaxLength,
} from 'class-validator';

export class CreateProjectDto {
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true })
  members?: string[];
}

export class UpdateProjectDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true })
  members?: string[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class ProjectDto {
  id: string;
  name: string;
  description?: string;
  createdBy: string;
  members: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class ProjectMemberDto {
  @IsMongoId()
  userId: string;
}

export class ProjectWithMembersDto extends ProjectDto {
  memberDetails: Array<{
    id: string;
    email: string;
    name: string;
    isOnline: boolean;
    lastSeen?: Date;
  }>;
}
