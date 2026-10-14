
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { TaskPriority, TaskStatus } from '@prisma/client';

export class CreateTaskDto {
  @IsUUID('4')
  companyId!: string;

  @IsUUID('4')
  branchId!: string;

  @IsUUID('4')
  assignedToId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;

  @IsOptional()
  @IsISO8601({ strict: true })
  dueDate?: string;
}

export class UpdateTaskDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @IsOptional()
  @IsUUID('4')
  assignedToId?: string;

  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;

  @IsOptional()
  @IsISO8601({ strict: true })
  dueDate?: string;
}

export class UpdateTaskStatusDto {
  @IsEnum(TaskStatus)
  status!: TaskStatus;
}

export class TaskListQueryDto {
  @IsOptional()
  @IsUUID('4')
  companyId?: string;

  @IsOptional()
  @IsUUID('4')
  branchId?: string;

  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;

  @IsOptional()
  @IsUUID('4')
  assignedToId?: string;
}

export class CreateTaskCommentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  message!: string;
}
