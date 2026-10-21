import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/gaurds/jwt-auth.guard';
import { WorkspaceRecordsService, WorkspaceActor } from './workspace-records.service';
import { AddSupportMessageDto, CreateBillingInvoiceDto, CreateEmployeeDocumentDto, CreateSupportTicketDto, RecordInvoicePaymentDto, SetWorkspacePreferenceDto, UpdateSupportTicketDto } from './dto/workspace-record.dto';

type RequestWithUser = { authUser: WorkspaceActor };

@Controller()
@UseGuards(JwtAuthGuard)
export class WorkspaceRecordsController {
  constructor(private readonly records: WorkspaceRecordsService) {}

  @Get('employee-documents/my')
  myDocuments(@Req() req: RequestWithUser) { return this.records.myDocuments(req.authUser); }

  @Get('employee-documents')
  documents(@Req() req: RequestWithUser, @Query('companyId', new ParseUUIDPipe({ version: '4' })) companyId: string, @Query('employeeId') employeeId?: string) {
    return this.records.companyDocuments(req.authUser, companyId, employeeId);
  }

  @Post('employee-documents')
  issueDocument(@Req() req: RequestWithUser, @Body() dto: CreateEmployeeDocumentDto) { return this.records.issueDocument(req.authUser, dto); }

  @Get('employee-documents/:id/file')
  documentFile(@Req() req: RequestWithUser, @Param('id', new ParseUUIDPipe({ version: '4' })) id: string) { return this.records.documentFile(req.authUser, id); }

  @Get('workspace/preferences')
  preference(@Req() req: RequestWithUser, @Query('companyId', new ParseUUIDPipe({ version: '4' })) companyId: string, @Query('key') key: string) { return this.records.getPreference(req.authUser, companyId, key); }

  @Post('workspace/preferences')
  setPreference(@Req() req: RequestWithUser, @Body() dto: SetWorkspacePreferenceDto) { return this.records.setPreference(req.authUser, dto); }

  @Delete('workspace/preferences')
  deletePreference(@Req() req: RequestWithUser, @Query('companyId', new ParseUUIDPipe({ version: '4' })) companyId: string, @Query('key') key: string) { return this.records.deletePreference(req.authUser, companyId, key); }

  @Post('support/tickets')
  createTicket(@Req() req: RequestWithUser, @Body() dto: CreateSupportTicketDto) { return this.records.createTicket(req.authUser, dto); }

  @Get('support/tickets/my')
  myTickets(@Req() req: RequestWithUser) { return this.records.myTickets(req.authUser); }

  @Get('support/tickets')
  tickets(@Req() req: RequestWithUser, @Query('companyId', new ParseUUIDPipe({ version: '4' })) companyId: string) { return this.records.tickets(req.authUser, companyId); }

  @Post('support/tickets/:id/messages')
  addTicketMessage(@Req() req: RequestWithUser, @Param('id', new ParseUUIDPipe({ version: '4' })) id: string, @Body() dto: AddSupportMessageDto) { return this.records.addTicketMessage(req.authUser, id, dto); }

  @Patch('support/tickets/:id')
  updateTicket(@Req() req: RequestWithUser, @Param('id', new ParseUUIDPipe({ version: '4' })) id: string, @Body() dto: UpdateSupportTicketDto) { return this.records.updateTicket(req.authUser, id, dto); }

  @Get('billing/invoices')
  invoices(@Req() req: RequestWithUser, @Query('companyId', new ParseUUIDPipe({ version: '4' })) companyId: string) { return this.records.invoices(req.authUser, companyId); }

  @Post('billing/invoices')
  createInvoice(@Req() req: RequestWithUser, @Body() dto: CreateBillingInvoiceDto) { return this.records.createInvoice(req.authUser, dto); }

  @Post('billing/invoices/:id/record-payment')
  recordPayment(@Req() req: RequestWithUser, @Param('id', new ParseUUIDPipe({ version: '4' })) id: string, @Body() dto: RecordInvoicePaymentDto) { return this.records.recordPayment(req.authUser, id, dto); }
}
