import { Body, Controller, Get, Param, ParseIntPipe, ParseUUIDPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { IsOptional, IsUUID } from 'class-validator';
import { JwtAuthGuard } from '../auth/gaurds/jwt-auth.guard';
import { PermissionsGuard } from '../auth/gaurds/permissions.guard';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { QuotesService } from './quotes.service';
import { DealActor } from './deals.service';
import { ChangeQuoteStatusDto, CreateQuoteDto, UpdateQuoteDto } from './dto/quote.dto';
class ListQuoteQuery {
  @IsOptional() @IsUUID('4') dealId?: string;
  @IsOptional() @IsUUID('4') companyId?: string;
  @IsOptional() @IsUUID('4') branchId?: string;
}
@Controller('quotes')
@UseGuards(JwtAuthGuard,PermissionsGuard)
export class QuotesController {
  constructor(private readonly service:QuotesService){}
  @Get() @RequirePermissions('crm.read') list(@Req() r:{authUser:DealActor},@Query() q:ListQuoteQuery){
    return q.dealId ? this.service.list(r.authUser,q.dealId) : this.service.listCompany(r.authUser,q.companyId,q.branchId);
  }
  @Get(':id') @RequirePermissions('crm.read') get(@Req() r:{authUser:DealActor},@Param('id',new ParseUUIDPipe({version:'4'})) id:string){return this.service.get(r.authUser,id);}
  @Post() @RequirePermissions('crm.manage') create(@Req() r:{authUser:DealActor},@Body() dto:CreateQuoteDto){return this.service.create(r.authUser,dto);}
  @Patch(':id') @RequirePermissions('crm.manage') update(@Req() r:{authUser:DealActor},@Param('id',new ParseUUIDPipe({version:'4'})) id:string,@Body() dto:UpdateQuoteDto){return this.service.update(r.authUser,id,dto);}
  @Post(':id/status') @RequirePermissions('crm.manage') status(@Req() r:{authUser:DealActor},@Param('id',new ParseUUIDPipe({version:'4'})) id:string,@Body() dto:ChangeQuoteStatusDto){return this.service.changeStatus(r.authUser,id,dto.status,dto.expectedVersion);}
}
