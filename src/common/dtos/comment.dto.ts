import {
  IsString,
  IsMongoId,
  MinLength,
  MaxLength,
  IsOptional,
} from 'class-validator';

export class CreateCommentDto {
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  content: string;

  @IsMongoId()
  taskId: string;

  @IsMongoId()
  projectId: string;
}

export class UpdateCommentDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  content?: string;
}

export class CommentDto {
  id: string;
  content: string;
  author: string;
  taskId: string;
  projectId: string;
  createdAt: Date;
  updatedAt: Date;
}

export class CommentWithAuthorDto extends CommentDto {
  authorDetails: {
    id: string;
    name: string;
    email: string;
  };
}

export class CommentResponseDto {
  comment: CommentWithAuthorDto;
}
