import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';

import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
  ) {}

  @Post()
  create(
    @Body() dto: CreateUserDto,
  ) {
    return this.usersService.create(dto);
  }

  @Get()
  findAll() {
    return this.usersService.findAll();
  }

  @Get(':id')
  findOne(
    @Param('id') id: string,
  ) {
    return this.usersService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
  ) {
    return this.usersService.update(
      id,
      dto,
    );
  }

  @Patch(':id/activate')
  activate(
    @Param('id') id: string,
  ) {
    return this.usersService.activate(id);
  }

  @Patch(':id/deactivate')
  deactivate(
    @Param('id') id: string,
  ) {
    return this.usersService.deactivate(id);
  }

  @Patch(':id/suspend')
  suspend(
    @Param('id') id: string,
  ) {
    return this.usersService.suspend(id);
  }
}