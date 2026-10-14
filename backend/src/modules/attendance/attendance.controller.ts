import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/gaurds/jwt-auth.guard';
import { AttendanceAuthUser, AttendanceService } from './attendance.service';
import { CheckInDto } from './dto/check-in.dto';
import { CheckOutDto } from './dto/check-out.dto';
import { MarkAttendanceDto } from './dto/mark-attendance.dto';
import { ListAttendanceDto } from './dto/list-attendance.dto';

interface AttendanceRequest {
  authUser: AttendanceAuthUser;
}

@Controller('attendance')
@UseGuards(JwtAuthGuard)
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Post('check-in')
  checkIn(@Req() request: AttendanceRequest, @Body() dto: CheckInDto) {
    return this.attendanceService.checkIn(request.authUser, dto);
  }

  @Post('check-out')
  checkOut(@Req() request: AttendanceRequest, @Body() dto: CheckOutDto) {
    return this.attendanceService.checkOut(request.authUser, dto);
  }

  @Post('mark')
  mark(@Req() request: AttendanceRequest, @Body() dto: MarkAttendanceDto) {
    return this.attendanceService.mark(request.authUser, dto);
  }

  @Get('my-history')
  myHistory(@Req() request: AttendanceRequest, @Query() query: ListAttendanceDto) {
    return this.attendanceService.findAll(request.authUser, query, true);
  }

  @Get()
  findAll(@Req() request: AttendanceRequest, @Query() query: ListAttendanceDto) {
    return this.attendanceService.findAll(request.authUser, query);
  }

  @Get(':id')
  findOne(
    @Req() request: AttendanceRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.attendanceService.findOne(request.authUser, id);
  }
}
