import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { BranchesService, type BranchActor } from './branches.service';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';
import { IsIn } from 'class-validator';
import { JwtAuthGuard } from '../auth/gaurds/jwt-auth.guard';
import { BusinessAdminGuard } from '../auth/gaurds/business-admin.guard';

type AuthenticatedRequest = { authUser: BranchActor };

class UpdateBranchStatusDto {
  @IsIn(['ACTIVE', 'INACTIVE'])
  status!: 'ACTIVE' | 'INACTIVE';
}

@UseGuards(JwtAuthGuard)
@Controller('branches')
export class BranchesController {
  constructor(private readonly branchesService: BranchesService) {}

  @Post()
  @UseGuards(BusinessAdminGuard)
  create(@Req() req: AuthenticatedRequest, @Body() dto: CreateBranchDto) {
    return this.branchesService.create(req.authUser, dto);
  }

  @Get()
  @UseGuards(BusinessAdminGuard)
  findAll(@Req() req: AuthenticatedRequest, @Query('companyId') companyId?: string) {
    return this.branchesService.findAll(req.authUser, companyId);
  }

  @Get('available')
  available(
    @Req() req: AuthenticatedRequest,
    @Query('companyId', new ParseUUIDPipe({ version: '4' })) companyId: string,
  ) {
    return this.branchesService.available(req.authUser, companyId);
  }

  @Get(':id')
  @UseGuards(BusinessAdminGuard)
  findOne(@Req() req: AuthenticatedRequest, @Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.branchesService.findOne(req.authUser, id);
  }

  @Patch(':id')
  @UseGuards(BusinessAdminGuard)
  update(@Req() req: AuthenticatedRequest, @Param('id', new ParseUUIDPipe({ version: '4' })) id: string, @Body() dto: UpdateBranchDto) {
    return this.branchesService.update(req.authUser, id, dto);
  }

  @Patch(':id/status')
  @UseGuards(BusinessAdminGuard)
  updateStatus(@Req() req: AuthenticatedRequest, @Param('id', new ParseUUIDPipe({ version: '4' })) id: string, @Body() dto: UpdateBranchStatusDto) {
    return this.branchesService.updateStatus(req.authUser, id, dto.status);
  }
}
