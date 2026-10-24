
import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';

import { JwtAuthGuard } from '../auth/gaurds/jwt-auth.guard';

import {
  TaskAuthUser,
  TasksService,
} from './tasks.service';

import {
  CreateTaskCommentDto,
  CreateTaskDto,
  TaskListQueryDto,
  UpdateTaskDto,
  UpdateTaskStatusDto,
} from './dto/task.dto';

interface AuthRequest {
  authUser: TaskAuthUser;
}

@Controller('tasks')
@UseGuards(JwtAuthGuard)
export class TasksController {
  constructor(private readonly tasks: TasksService) {}

  @Post()
  create(
    @Req() req: AuthRequest,
    @Body() dto: CreateTaskDto,
  ) {
    return this.tasks.create(req.authUser, dto);
  }

  @Get('my')
  myTasks(@Req() req: AuthRequest) {
    return this.tasks.myTasks(req.authUser);
  }

  @Get('assignees')
  assignees(@Req() req: AuthRequest, @Query('companyId', new ParseUUIDPipe({ version: '4' })) companyId: string) {
    return this.tasks.assignees(req.authUser, companyId);
  }

  @Get()
  list(
    @Req() req: AuthRequest,
    @Query() query: TaskListQueryDto,
  ) {
    return this.tasks.list(req.authUser, query);
  }

  @Get(':id')
  getOne(
    @Req() req: AuthRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' }))
    id: string,
  ) {
    return this.tasks.getOne(req.authUser, id);
  }

  @Patch(':id')
  update(
    @Req() req: AuthRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' }))
    id: string,
    @Body() dto: UpdateTaskDto,
  ) {
    return this.tasks.update(req.authUser, id, dto);
  }

  @Patch(':id/status')
  updateStatus(
    @Req() req: AuthRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' }))
    id: string,
    @Body() dto: UpdateTaskStatusDto,
  ) {
    return this.tasks.updateStatus(req.authUser, id, dto);
  }

  @Post(':id/comments')
  addComment(
    @Req() req: AuthRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' }))
    id: string,
    @Body() dto: CreateTaskCommentDto,
  ) {
    return this.tasks.addComment(req.authUser, id, dto);
  }
}
