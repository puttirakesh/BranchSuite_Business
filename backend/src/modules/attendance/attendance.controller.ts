
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
  AttendanceAuthUser,
  AttendanceService,
} from './attendance.service';

import { AttendanceCorrectionsService } from './attendance-corrections.service';

import { CheckInDto } from './dto/check-in.dto';
import { CheckOutDto } from './dto/check-out.dto';
import { MarkAttendanceDto } from './dto/mark-attendance.dto';
import { ListAttendanceDto } from './dto/list-attendance.dto';

import {
  CreateAttendanceCorrectionDto,
  ListAttendanceCorrectionsDto,
  ReviewAttendanceCorrectionDto,
} from './dto/attendance-correction.dto';

interface AttendanceRequest {
  authUser: AttendanceAuthUser;
}

@Controller('attendance')
@UseGuards(JwtAuthGuard)
export class AttendanceController {
  constructor(
    private readonly attendanceService: AttendanceService,
    private readonly correctionsService: AttendanceCorrectionsService,
  ) {}

  // =====================================================
  // EXISTING ATTENDANCE ROUTES
  // =====================================================

  @Post('check-in')
  checkIn(
    @Req() request: AttendanceRequest,
    @Body() dto: CheckInDto,
  ) {
    return this.attendanceService.checkIn(
      request.authUser,
      dto,
    );
  }

  @Post('check-out')
  checkOut(
    @Req() request: AttendanceRequest,
    @Body() dto: CheckOutDto,
  ) {
    return this.attendanceService.checkOut(
      request.authUser,
      dto,
    );
  }

  @Post('mark')
  mark(
    @Req() request: AttendanceRequest,
    @Body() dto: MarkAttendanceDto,
  ) {
    return this.attendanceService.mark(
      request.authUser,
      dto,
    );
  }

  @Get('my-history')
  myHistory(
    @Req() request: AttendanceRequest,
    @Query() query: ListAttendanceDto,
  ) {
    return this.attendanceService.findAll(
      request.authUser,
      query,
      true,
    );
  }

  // =====================================================
  // ATTENDANCE CORRECTION ROUTES
  // =====================================================

  @Post('corrections')
  createCorrection(
    @Req() request: AttendanceRequest,
    @Body() dto: CreateAttendanceCorrectionDto,
  ) {
    return this.correctionsService.create(
      request.authUser,
      dto,
    );
  }

  @Get('corrections/my')
  myCorrections(
    @Req() request: AttendanceRequest,
  ) {
    return this.correctionsService.myRequests(
      request.authUser,
    );
  }

  @Get('corrections')
  listCorrections(
    @Req() request: AttendanceRequest,
    @Query() query: ListAttendanceCorrectionsDto,
  ) {
    return this.correctionsService.list(
      request.authUser,
      query,
    );
  }

  @Patch('corrections/:id/approve')
  approveCorrection(
    @Req() request: AttendanceRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' }))
    id: string,
    @Body() dto: ReviewAttendanceCorrectionDto,
  ) {
    return this.correctionsService.review(
      request.authUser,
      id,
      true,
      dto,
    );
  }

  @Patch('corrections/:id/reject')
  rejectCorrection(
    @Req() request: AttendanceRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' }))
    id: string,
    @Body() dto: ReviewAttendanceCorrectionDto,
  ) {
    return this.correctionsService.review(
      request.authUser,
      id,
      false,
      dto,
    );
  }

  @Patch('corrections/:id/cancel')
  cancelCorrection(
    @Req() request: AttendanceRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' }))
    id: string,
  ) {
    return this.correctionsService.cancel(
      request.authUser,
      id,
    );
  }

  // =====================================================
  // GENERAL ATTENDANCE LIST / DETAIL
  // =====================================================

  @Get()
  findAll(
    @Req() request: AttendanceRequest,
    @Query() query: ListAttendanceDto,
  ) {
    return this.attendanceService.findAll(
      request.authUser,
      query,
    );
  }

  @Get(':id')
  findOne(
    @Req() request: AttendanceRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' }))
    id: string,
  ) {
    return this.attendanceService.findOne(
      request.authUser,
      id,
    );
  }
}
