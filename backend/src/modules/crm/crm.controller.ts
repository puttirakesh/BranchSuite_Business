
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
import { RecordStatus } from '@prisma/client';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

import { JwtAuthGuard } from '../auth/gaurds/jwt-auth.guard';
import { PermissionsGuard } from '../auth/gaurds/permissions.guard';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';

import {
  CrmAuthUser,
  CrmService,
} from './crm.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';

class ListCustomersDto {
  @IsOptional()
  @IsUUID('4')
  companyId?: string;

  @IsOptional()
  @IsUUID('4')
  branchId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsEnum(RecordStatus)
  status?: RecordStatus;
}

class ChangeCustomerStatusDto {
  @IsEnum(RecordStatus)
  status!: RecordStatus;
}

interface CrmRequest {
  authUser: CrmAuthUser;
}

@Controller('customers')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class CrmController {
  constructor(private readonly crmService: CrmService) {}

  @Post()
  @RequirePermissions('crm.manage')
  create(
    @Req() request: CrmRequest,
    @Body() dto: CreateCustomerDto,
  ) {
    return this.crmService.create(request.authUser, dto);
  }

  @Get()
  @RequirePermissions('crm.read')
  findAll(
    @Req() request: CrmRequest,
    @Query() query: ListCustomersDto,
  ) {
    return this.crmService.findAll(request.authUser, query);
  }

  @Get(':id')
  @RequirePermissions('crm.read')
  findOne(
    @Req() request: CrmRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.crmService.findOne(request.authUser, id);
  }

  @Patch(':id')
  @RequirePermissions('crm.manage')
  update(
    @Req() request: CrmRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateCustomerDto,
  ) {
    return this.crmService.update(request.authUser, id, dto);
  }

  @Patch(':id/status')
  @RequirePermissions('crm.manage')
  changeStatus(
    @Req() request: CrmRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: ChangeCustomerStatusDto,
  ) {
    return this.crmService.changeStatus(
      request.authUser,
      id,
      dto.status,
    );
  }
}
