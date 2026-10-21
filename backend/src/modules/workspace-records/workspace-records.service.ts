import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AddSupportMessageDto, CreateBillingInvoiceDto, CreateEmployeeDocumentDto, CreateSupportTicketDto, RecordInvoicePaymentDto, SetWorkspacePreferenceDto, UpdateSupportTicketDto } from './dto/workspace-record.dto';

export type WorkspaceActor = { id: string; tenantId: string; roles: string[] };

@Injectable()
export class WorkspaceRecordsService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  private isAdmin(user: WorkspaceActor) {
    return user.roles.some(role => ['BUSINESS_OWNER', 'BUSINESS_ADMIN'].includes(role));
  }

  private isHr(user: WorkspaceActor) {
    return user.roles.some(role => ['BUSINESS_OWNER', 'BUSINESS_ADMIN', 'HR_MANAGER'].includes(role));
  }

  private async company(user: WorkspaceActor, companyId: string) {
    const company = await this.prisma.company.findFirst({
      where: { id: companyId, tenantId: user.tenantId, status: 'ACTIVE', ...(!user.roles.includes('BUSINESS_OWNER') ? { userAccess: { some: { userId: user.id } } } : {}) },
      select: { id: true },
    });
    if (!company) throw new NotFoundException('Company not found or access denied');
    return company;
  }

  private async branch(user: WorkspaceActor, companyId: string, branchId: string) {
    const branch = await this.prisma.branch.findFirst({
      where: { id: branchId, companyId, status: 'ACTIVE', ...(!user.roles.includes('BUSINESS_OWNER') ? { userAccess: { some: { userId: user.id } } } : {}) },
      select: { id: true },
    });
    if (!branch) throw new NotFoundException('Branch not found or access denied');
    return branch;
  }

  private documentSummary = { id: true, tenantId: true, companyId: true, branchId: true, employeeId: true, createdById: true, title: true, kind: true, content: true, fileName: true, mimeType: true, fileSize: true, status: true, createdAt: true, updatedAt: true } as const;

  async myDocuments(user: WorkspaceActor) {
    return this.prisma.employeeDocument.findMany({ where: { tenantId: user.tenantId, employeeId: user.id }, select: this.documentSummary, orderBy: { createdAt: 'desc' } });
  }

  async companyDocuments(user: WorkspaceActor, companyId: string, employeeId?: string) {
    if (!this.isHr(user)) throw new ForbiddenException('HR administrator access required');
    await this.company(user, companyId);
    const allowedBranchIds = user.roles.includes('BUSINESS_OWNER') ? undefined : (await this.prisma.branch.findMany({ where: { companyId, userAccess: { some: { userId: user.id } } }, select: { id: true } })).map(branch => branch.id);
    return this.prisma.employeeDocument.findMany({
      where: { tenantId: user.tenantId, companyId, ...(employeeId ? { employeeId } : {}), ...(allowedBranchIds ? { branchId: { in: allowedBranchIds } } : {}) },
      select: this.documentSummary,
      orderBy: { createdAt: 'desc' },
    });
  }

  async issueDocument(user: WorkspaceActor, dto: CreateEmployeeDocumentDto) {
    if (!this.isHr(user)) throw new ForbiddenException('HR administrator access required');
    const title = dto.title.trim();
    const content = dto.content?.trim() || null;
    const fileName = dto.fileName?.trim() || null;
    let fileData: Buffer | null = null;
    if (dto.fileDataBase64) {
      const raw = dto.fileDataBase64.replace(/^data:[^;]+;base64,/, '');
      if (!/^[A-Za-z0-9+/]*={0,2}$/.test(raw) || raw.length % 4 !== 0) throw new BadRequestException('Document file is invalid');
      fileData = Buffer.from(raw, 'base64');
      if (!fileData.length || fileData.length > 5 * 1024 * 1024) throw new BadRequestException('Document files must be 5 MB or smaller');
      if (!fileName || !dto.mimeType) throw new BadRequestException('File name and type are required');
    }
    if (title.length < 2 || (!content && !fileData)) throw new BadRequestException('Add document text or attach a file');
    await this.company(user, dto.companyId);
    await this.branch(user, dto.companyId, dto.branchId);
    const employee = await this.prisma.employeeProfile.findFirst({
      where: { tenantId: user.tenantId, companyId: dto.companyId, branchId: dto.branchId, userId: dto.employeeId, status: 'ACTIVE' },
      select: { userId: true },
    });
    if (!employee) throw new NotFoundException('Active employee not found in this branch');
    return this.prisma.$transaction(async tx => {
      const document = await tx.employeeDocument.create({ data: {
        tenantId: user.tenantId, companyId: dto.companyId, branchId: dto.branchId,
        employeeId: dto.employeeId, createdById: user.id, title, kind: dto.kind,
        content, fileName, mimeType: dto.mimeType ?? null, fileSize: fileData?.length ?? null, fileData: fileData ? Uint8Array.from(fileData) : null,
      } });
      await this.audit.record(tx, { actor: user, module: 'EMPLOYEES', action: 'DOCUMENT_ISSUED', companyId: dto.companyId, branchId: dto.branchId, targetId: document.id, changes: { employeeId: dto.employeeId, title: document.title } });
      const { fileData: _fileData, ...summary } = document;
      return summary;
    });
  }

  async documentFile(user: WorkspaceActor, id: string) {
    const document = await this.prisma.employeeDocument.findFirst({ where: { id, tenantId: user.tenantId }, select: { ...this.documentSummary, fileData: true } });
    if (!document) throw new NotFoundException('Document not found');
    if (document.employeeId !== user.id) {
      if (!this.isHr(user)) throw new ForbiddenException('Document access denied');
      await this.company(user, document.companyId);
      if (!user.roles.includes('BUSINESS_OWNER')) {
        const branch = await this.prisma.branch.findFirst({ where: { id: document.branchId, companyId: document.companyId, userAccess: { some: { userId: user.id } } }, select: { id: true } });
        if (!branch) throw new NotFoundException('Document not found or access denied');
      }
    }
    if (!document.fileData || !document.fileName || !document.mimeType) throw new NotFoundException('This document has no attached file');
    return { fileName: document.fileName, mimeType: document.mimeType, fileDataBase64: Buffer.from(document.fileData).toString('base64') };
  }

  async getPreference(user: WorkspaceActor, companyId: string, key: string) {
    if (!['profile', 'workspace', 'crm-lead-draft'].includes(key)) throw new BadRequestException('Unsupported preference');
    await this.company(user, companyId);
    return this.prisma.userWorkspacePreference.findUnique({ where: { userId_companyId_key: { userId: user.id, companyId, key } }, select: { key: true, value: true, updatedAt: true } });
  }

  async setPreference(user: WorkspaceActor, dto: SetWorkspacePreferenceDto) {
    await this.company(user, dto.companyId);
    const json = JSON.stringify(dto.value);
    if (json.length > 100_000) throw new BadRequestException('Preference is too large');
    return this.prisma.userWorkspacePreference.upsert({ where: { userId_companyId_key: { userId: user.id, companyId: dto.companyId, key: dto.key } }, create: { userId: user.id, companyId: dto.companyId, key: dto.key, value: dto.value as Prisma.InputJsonValue }, update: { value: dto.value as Prisma.InputJsonValue }, select: { key: true, value: true, updatedAt: true } });
  }

  async deletePreference(user: WorkspaceActor, companyId: string, key: string) {
    await this.company(user, companyId);
    await this.prisma.userWorkspacePreference.deleteMany({ where: { userId: user.id, companyId, key } });
    return { ok: true };
  }

  async createTicket(user: WorkspaceActor, dto: CreateSupportTicketDto) {
    const subject = dto.subject.trim();
    const message = dto.message.trim();
    if (subject.length < 4 || message.length < 10) throw new BadRequestException('Enter a subject and at least 10 characters describing the issue');
    await this.company(user, dto.companyId);
    if (dto.branchId) await this.branch(user, dto.companyId, dto.branchId);
    return this.prisma.$transaction(async tx => {
      const ticket = await tx.supportTicket.create({
        data: {
          tenantId: user.tenantId, companyId: dto.companyId, branchId: dto.branchId ?? null,
          createdById: user.id, subject, category: dto.category,
          messages: { create: { authorId: user.id, message } },
        },
        include: { messages: { orderBy: { createdAt: 'asc' } } },
      });
      await this.audit.record(tx, { actor: user, module: 'SUPPORT', action: 'TICKET_CREATED', companyId: dto.companyId, branchId: dto.branchId, targetId: ticket.id, changes: { category: dto.category } });
      return ticket;
    });
  }

  async myTickets(user: WorkspaceActor) {
    return this.prisma.supportTicket.findMany({ where: { tenantId: user.tenantId, createdById: user.id }, include: { messages: { orderBy: { createdAt: 'asc' } } }, orderBy: { updatedAt: 'desc' } });
  }

  async tickets(user: WorkspaceActor, companyId: string) {
    if (!this.isAdmin(user)) throw new ForbiddenException('Business administrator access required');
    await this.company(user, companyId);
    return this.prisma.supportTicket.findMany({ where: { tenantId: user.tenantId, companyId }, include: { messages: { orderBy: { createdAt: 'asc' } } }, orderBy: { updatedAt: 'desc' } });
  }

  private async ticket(user: WorkspaceActor, id: string) {
    const ticket = await this.prisma.supportTicket.findFirst({ where: { id, tenantId: user.tenantId }, include: { messages: { orderBy: { createdAt: 'asc' } } } });
    if (!ticket) throw new NotFoundException('Support ticket not found');
    if (!this.isAdmin(user) && ticket.createdById !== user.id) throw new ForbiddenException('Ticket access denied');
    if (this.isAdmin(user)) await this.company(user, ticket.companyId);
    return ticket;
  }

  async addTicketMessage(user: WorkspaceActor, id: string, dto: AddSupportMessageDto) {
    const message = dto.message.trim();
    if (!message) throw new BadRequestException('Reply message is required');
    const ticket = await this.ticket(user, id);
    return this.prisma.$transaction(async tx => {
      const current = await tx.supportTicket.findFirst({ where: { id, tenantId: user.tenantId }, select: { status: true } });
      if (!current) throw new NotFoundException('Support ticket not found');
      if (current.status === 'CLOSED') throw new BadRequestException('Reopen the ticket before adding a reply');
      await tx.supportTicketMessage.create({ data: { ticketId: id, authorId: user.id, message } });
      const updated = await tx.supportTicket.update({ where: { id }, data: { ...(current.status === 'RESOLVED' ? { status: 'OPEN' } : {}) }, include: { messages: { orderBy: { createdAt: 'asc' } } } });
      await this.audit.record(tx, { actor: user, module: 'SUPPORT', action: 'TICKET_REPLIED', companyId: ticket.companyId, branchId: ticket.branchId ?? undefined, targetId: id, changes: { reopened: current.status === 'RESOLVED' } });
      return updated;
    });
  }

  async updateTicket(user: WorkspaceActor, id: string, dto: UpdateSupportTicketDto) {
    if (!this.isAdmin(user)) throw new ForbiddenException('Business administrator access required');
    const ticket = await this.ticket(user, id);
    return this.prisma.$transaction(async tx => {
      const updated = await tx.supportTicket.update({ where: { id }, data: { status: dto.status }, include: { messages: { orderBy: { createdAt: 'asc' } } } });
      await this.audit.record(tx, { actor: user, module: 'SUPPORT', action: 'TICKET_STATUS_CHANGED', companyId: ticket.companyId, branchId: ticket.branchId ?? undefined, targetId: id, changes: { from: ticket.status, to: dto.status } });
      return updated;
    });
  }

  async invoices(user: WorkspaceActor, companyId: string) {
    if (!this.isAdmin(user)) throw new ForbiddenException('Business administrator access required');
    await this.company(user, companyId);
    return this.prisma.billingInvoice.findMany({ where: { tenantId: user.tenantId, companyId }, orderBy: { issuedAt: 'desc' } });
  }

  async createInvoice(user: WorkspaceActor, dto: CreateBillingInvoiceDto) {
    if (!this.isAdmin(user)) throw new ForbiddenException('Business administrator access required');
    const description = dto.description.trim();
    if (description.length < 3) throw new BadRequestException('Invoice description is required');
    if (dto.currency && !/^[A-Z]{3}$/i.test(dto.currency)) throw new BadRequestException('Currency must be a three-letter code');
    await this.company(user, dto.companyId);
    if (dto.subscriptionId) {
      const subscription = await this.prisma.businessSubscription.findFirst({ where: { id: dto.subscriptionId, tenantId: user.tenantId }, select: { id: true } });
      if (!subscription) throw new NotFoundException('Subscription not found');
    }
    if (!/^\d+(\.\d{1,2})?$/.test(dto.amount)) throw new BadRequestException('Invoice amount must have at most two decimal places');
    const amount = new Prisma.Decimal(dto.amount);
    if (!amount.isFinite() || !amount.greaterThan(0) || amount.greaterThan('999999999999.99')) throw new BadRequestException('Invoice amount must be a positive amount with at most two decimal places');
    let dueAt: Date | undefined;
    if (dto.dueDate) {
      dueAt = new Date(`${dto.dueDate}T00:00:00.000Z`);
      if (Number.isNaN(dueAt.getTime()) || dueAt.toISOString().slice(0, 10) !== dto.dueDate) throw new BadRequestException('Invoice due date is invalid');
    }
    const invoiceNumber = `BS-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    return this.prisma.$transaction(async tx => {
      const invoice = await tx.billingInvoice.create({ data: {
        tenantId: user.tenantId, companyId: dto.companyId, subscriptionId: dto.subscriptionId ?? null,
        invoiceNumber, description, amount,
        currency: dto.currency?.toUpperCase() ?? 'INR', dueAt, createdById: user.id,
      } });
      await this.audit.record(tx, { actor: user, module: 'BILLING', action: 'INVOICE_ISSUED', companyId: dto.companyId, targetId: invoice.id, changes: { invoiceNumber, amount: amount.toString(), currency: invoice.currency } });
      return invoice;
    });
  }

  async recordPayment(user: WorkspaceActor, id: string, dto: RecordInvoicePaymentDto) {
    if (!this.isAdmin(user)) throw new ForbiddenException('Business administrator access required');
    const note = dto.note.trim();
    if (note.length < 2) throw new BadRequestException('Payment confirmation note is required');
    const invoice = await this.prisma.billingInvoice.findFirst({ where: { id, tenantId: user.tenantId } });
    if (!invoice) throw new NotFoundException('Invoice not found');
    await this.company(user, invoice.companyId);
    if (invoice.status !== 'ISSUED') throw new BadRequestException('Only issued invoices can be marked paid');
    return this.prisma.$transaction(async tx => {
      const updated = await tx.billingInvoice.updateMany({
        where: { id, tenantId: user.tenantId, status: 'ISSUED' },
        data: { status: 'PAID', paidAt: new Date(), paymentNote: note },
      });
      if (updated.count !== 1) throw new ConflictException('Invoice status changed; reload and retry');
      const paid = await tx.billingInvoice.findUniqueOrThrow({ where: { id } });
      await this.audit.record(tx, { actor: user, module: 'BILLING', action: 'INVOICE_MARKED_PAID', companyId: invoice.companyId, targetId: id, changes: { paymentNote: note } });
      return paid;
    });
  }
}
