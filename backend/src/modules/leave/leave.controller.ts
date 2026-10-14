import {
  Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, Req, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/gaurds/jwt-auth.guard';
import { LeaveAuthUser, LeaveService } from './leave.service';
import { CreateLeaveTypeDto } from './dto/create-leave-type.dto';
import { CreateLeaveRequestDto } from './dto/create-leave-request.dto';
import { ReviewLeaveDto } from './dto/review-leave.dto';
import { AllocateLeaveBalanceDto } from './dto/allocate-leave-balance.dto';
import { ListLeaveRequestsDto } from './dto/list-leave-requests.dto';
import { ListLeaveBalancesDto } from './dto/list-leave-balances.dto';

interface AuthenticatedRequest { authUser: LeaveAuthUser }

@Controller('leave')
@UseGuards(JwtAuthGuard)
export class LeaveController {
  constructor(private readonly leave: LeaveService) {}

  @Post('types')
  createType(@Req() req: AuthenticatedRequest, @Body() dto: CreateLeaveTypeDto) {
    return this.leave.createType(req.authUser, dto);
  }

  @Get('types')
  listTypes(@Req() req: AuthenticatedRequest, @Query('companyId', new ParseUUIDPipe({ version: '4' })) companyId: string) {
    return this.leave.listTypes(req.authUser, companyId);
  }

  @Post('balances/allocate')
  allocate(@Req() req: AuthenticatedRequest, @Body() dto: AllocateLeaveBalanceDto) {
    return this.leave.allocate(req.authUser, dto);
  }

  @Get('balances/my')
  myBalances(@Req() req: AuthenticatedRequest, @Query('companyId', new ParseUUIDPipe({ version: '4' })) companyId: string, @Query('branchId', new ParseUUIDPipe({ version: '4' })) branchId: string, @Query('year') year?: string) {
    return this.leave.getBalances(req.authUser, { companyId, branchId, userId: req.authUser.id, year: this.leave.parseYear(year) });
  }

  @Get('balances')
  balances(@Req() req: AuthenticatedRequest, @Query() dto: ListLeaveBalancesDto) {
    return this.leave.getBalances(req.authUser, dto);
  }

  @Post('requests')
  apply(@Req() req: AuthenticatedRequest, @Body() dto: CreateLeaveRequestDto) {
    return this.leave.apply(req.authUser, dto);
  }

  @Get('requests/my')
  myRequests(@Req() req: AuthenticatedRequest, @Query() query: ListLeaveRequestsDto) {
    return this.leave.listRequests(req.authUser, query, true);
  }

  @Get('requests')
  requests(@Req() req: AuthenticatedRequest, @Query() query: ListLeaveRequestsDto) {
    return this.leave.listRequests(req.authUser, query, false);
  }

  @Patch('requests/:id/approve')
  approve(@Req() req: AuthenticatedRequest, @Param('id', new ParseUUIDPipe({ version: '4' })) id: string, @Body() dto: ReviewLeaveDto) {
    return this.leave.review(req.authUser, id, 'APPROVED', dto);
  }

  @Patch('requests/:id/reject')
  reject(@Req() req: AuthenticatedRequest, @Param('id', new ParseUUIDPipe({ version: '4' })) id: string, @Body() dto: ReviewLeaveDto) {
    return this.leave.review(req.authUser, id, 'REJECTED', dto);
  }

  @Patch('requests/:id/cancel')
  cancel(@Req() req: AuthenticatedRequest, @Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.leave.cancel(req.authUser, id);
  }
}
