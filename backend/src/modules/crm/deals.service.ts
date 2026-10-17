import {
  BadRequestException, ConflictException, ForbiddenException,
  Injectable, NotFoundException,
} from '@nestjs/common';
import { Prisma, RecordStatus, UserStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateDealDto, UpdateDealDto, DealStage } from './dto/deal.dto';

export interface DealActor { id: string; tenantId: string; roles: string[] }

@Injectable()
export class DealsService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  private admin(user: DealActor) {
    return user.roles.includes('BUSINESS_OWNER') || user.roles.includes('BUSINESS_ADMIN');
  }

  private async access(user: DealActor, companyId: string, branchId: string | null) {
    const company = await this.prisma.company.findFirst({
      where: { id: companyId, tenantId: user.tenantId, status: RecordStatus.ACTIVE },
    });
    if (!company) throw new NotFoundException('Company not found');
    if (branchId) {
      const branch = await this.prisma.branch.findFirst({
        where: { id: branchId, companyId, status: RecordStatus.ACTIVE },
      });
      if (!branch) throw new NotFoundException('Branch not found');
    }
    if (this.admin(user)) return;
    const companyGrant = await this.prisma.userCompanyAccess.findUnique({
      where: { userId_companyId: { userId: user.id, companyId } },
    });
    if (!companyGrant) throw new ForbiddenException('Company access denied');
    if (!branchId) throw new ForbiddenException('Branch is required for this role');
    const branchGrant = await this.prisma.userBranchAccess.findUnique({
      where: { userId_branchId: { userId: user.id, branchId } },
    });
    if (!branchGrant) throw new ForbiddenException('Branch access denied');
  }

  private async validateLinks(user: DealActor, d: {companyId: string; branchId?: string | null; leadId?: string | null; customerId?: string | null; ownerId?: string}) {
    if (d.leadId) {
      const lead = await this.prisma.lead.findFirst({where:{id:d.leadId,tenantId:user.tenantId,companyId:d.companyId}});
      if (!lead || lead.branchId !== (d.branchId ?? null)) throw new BadRequestException('Lead must belong to the deal company and branch');
    }
    if (d.customerId) {
      const customer = await this.prisma.customer.findFirst({where:{id:d.customerId,tenantId:user.tenantId,companyId:d.companyId}});
      if (!customer || (customer.branchId && customer.branchId !== (d.branchId ?? null))) throw new BadRequestException('Customer outside selected company/branch');
    }
    if (d.ownerId) {
      const owner = await this.prisma.user.findFirst({where:{id:d.ownerId,tenantId:user.tenantId,status:UserStatus.ACTIVE}});
      if (!owner) throw new BadRequestException('Owner is not an active user');
      if (d.ownerId !== user.id && !this.admin(user)) throw new ForbiddenException('Only business admin can assign another owner');
      if (!this.admin(user)) return;
      const grant = await this.prisma.userCompanyAccess.findUnique({where:{userId_companyId:{userId:d.ownerId,companyId:d.companyId}}});
      const ownerAdminRole = await this.prisma.userRole.findFirst({where:{userId:d.ownerId, role:{name:{in:['BUSINESS_OWNER','BUSINESS_ADMIN']}}}});
      if (!grant && !ownerAdminRole) throw new BadRequestException('Owner does not have company access');
      if (d.branchId && !ownerAdminRole) {
        const branchGrant = await this.prisma.userBranchAccess.findUnique({where:{userId_branchId:{userId:d.ownerId,branchId:d.branchId}}});
        if (!branchGrant) throw new BadRequestException('Owner does not have branch access');
      }
    }
  }

  async create(user: DealActor, dto: CreateDealDto) {
    await this.access(user, dto.companyId, dto.branchId ?? null);
    await this.validateLinks(user, {...dto, ownerId: dto.ownerId ?? user.id});
    return this.prisma.$transaction(async tx => {
      const created = await tx.deal.create({data:{
      tenantId:user.tenantId,companyId:dto.companyId,branchId:dto.branchId ?? null,
      leadId:dto.leadId ?? null,customerId:dto.customerId ?? null,
      ownerId:dto.ownerId ?? user.id,title:dto.title.trim(),
      amount:dto.amount != null ? new Prisma.Decimal(dto.amount) : null,
      currency:dto.currency ?? 'INR',
      expectedCloseAt:dto.expectedCloseAt ? new Date(dto.expectedCloseAt) : null,
      notes:dto.notes ?? null,
    }});
      await this.audit.record(tx, { actor:user, module:'CRM', action:'DEAL_CREATED', companyId:dto.companyId, branchId:dto.branchId??undefined, targetId:created.id });
      return created;
    });
  }

  async list(user:DealActor, companyId:string, branchId?:string) {
    if (branchId || this.admin(user)) {
      await this.access(user, companyId, branchId ?? null);
    } else {
      // Validate membership and company before using assigned-branch scope.
      const company = await this.prisma.company.findFirst({
        where: { id: companyId, tenantId: user.tenantId, status: RecordStatus.ACTIVE },
      });
      const grant = await this.prisma.userCompanyAccess.findUnique({
        where: { userId_companyId: { userId: user.id, companyId } },
      });
      if (!company || !grant) throw new ForbiddenException('Company access denied');
    }
    let scopedBranches: string[] | undefined;
    if (!this.admin(user) && !branchId) {
      const grants = await this.prisma.userBranchAccess.findMany({
        where: { userId: user.id, branch: { companyId, status: RecordStatus.ACTIVE } },
        select: { branchId: true },
      });
      scopedBranches = grants.map(g => g.branchId);
    }
    return this.prisma.deal.findMany({
      where: { tenantId: user.tenantId, companyId,
        ...(branchId ? { branchId } : scopedBranches ? { branchId: { in: scopedBranches } } : {}),
      },
      orderBy: { updatedAt: 'desc' }, take: 100,
    });
  }

  async eligibleOwners(user: DealActor, companyId: string, branchId?: string) {
    if (branchId || this.admin(user)) {
      await this.access(user, companyId, branchId ?? null);
    } else {
      const company = await this.prisma.company.findFirst({
        where: { id: companyId, tenantId: user.tenantId, status: RecordStatus.ACTIVE },
      });
      const grant = await this.prisma.userCompanyAccess.findUnique({
        where: { userId_companyId: { userId: user.id, companyId } },
      });
      if (!company || !grant) throw new ForbiddenException('Company access denied');
    }
    if (!this.admin(user)) {
      const self = await this.prisma.user.findFirst({
        where: { id: user.id, tenantId: user.tenantId, status: UserStatus.ACTIVE },
        select: { id: true, name: true, email: true },
      });
      return self ? [self] : [];
    }
    const users = await this.prisma.user.findMany({
      where: { tenantId: user.tenantId, status: UserStatus.ACTIVE,
        OR: [
          { companyAccess: { some: { companyId } } },
          { roles: { some: { role: { name: { in: ['BUSINESS_OWNER', 'BUSINESS_ADMIN'] } } } } },
        ],
      },
      select: { id: true, name: true, email: true,
        roles: { select: { role: { select: { name: true } } } },
        branchAccess: { select: { branchId: true } },
      }, take: 300,
    });
    return users.filter(u => !branchId || u.roles.some(r => ['BUSINESS_OWNER','BUSINESS_ADMIN'].includes(r.role.name)) || u.branchAccess.some(b => b.branchId === branchId))
      .map(u => ({ id: u.id, name: u.name, email: u.email }));
  }

  async history(user: DealActor, id: string) {
    await this.getAccessible(user, id);
    return this.prisma.dealStageHistory.findMany({
      where: { dealId: id, tenantId: user.tenantId },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], take: 200,
    });
  }

  private async getAccessible(user: DealActor, id:string) {
    const deal=await this.prisma.deal.findFirst({where:{id,tenantId:user.tenantId}});
    if (!deal) throw new NotFoundException('Deal not found');
    await this.access(user,deal.companyId,deal.branchId);
    return deal;
  }

  async get(user:DealActor,id:string) {return this.getAccessible(user,id);}

  async update(user:DealActor,id:string,dto:UpdateDealDto) {
    const deal=await this.getAccessible(user,id);
    if (deal.stage==='WON' || deal.stage==='LOST') throw new ConflictException('Closed deals cannot be edited; correction workflow required');
    await this.validateLinks(user,{companyId:deal.companyId,branchId:deal.branchId,
      leadId:dto.leadId===undefined?deal.leadId:dto.leadId,
      customerId:dto.customerId===undefined?deal.customerId:dto.customerId,
      ownerId:dto.ownerId===undefined?deal.ownerId:dto.ownerId});
    return this.prisma.$transaction(async tx => {
      const updated = await tx.deal.update({where:{id},data:{
      ...(dto.title !== undefined ? {title:dto.title.trim()}:{}),
      ...(dto.notes !== undefined ? {notes:dto.notes}:{}),
      ...(dto.amount !== undefined ? {amount:dto.amount === null ? null : new Prisma.Decimal(dto.amount)}:{}),
      ...(dto.currency !== undefined ? {currency:dto.currency}:{}),
      ...(dto.expectedCloseAt !== undefined ? {expectedCloseAt:dto.expectedCloseAt ? new Date(dto.expectedCloseAt):null}:{}),
      ...(dto.leadId !== undefined ? {leadId:dto.leadId}:{}),
      ...(dto.customerId !== undefined ? {customerId:dto.customerId}:{}),
      ...(dto.ownerId !== undefined ? {ownerId:dto.ownerId}:{}),
    }});
      await this.audit.record(tx,{actor:user,module:'CRM',action:'DEAL_UPDATED',companyId:deal.companyId,branchId:deal.branchId??undefined,targetId:id,changes:{fields:Object.keys(dto)}});
      return updated;
    });
  }

  async transition(user:DealActor,id:string,stage:DealStage,lossReason?:string) {
    const deal=await this.getAccessible(user,id);
    const transitions:Record<string,string[]>={DISCOVERY:['QUALIFIED','LOST'],QUALIFIED:['PROPOSAL','LOST'],PROPOSAL:['NEGOTIATION','LOST'],NEGOTIATION:['WON','LOST'],WON:[],LOST:[]};
    if (!transitions[deal.stage]?.includes(stage)) throw new BadRequestException('Invalid pipeline transition');
    if (stage==='WON' && (!deal.customerId || deal.amount===null)) throw new BadRequestException('Customer and amount required to win');
    if (stage==='LOST' && !lossReason?.trim()) throw new BadRequestException('Loss reason required');
    // Stage update and history are committed together. Concurrent requests cannot
    // both succeed against the same prior stage/revision.
    return this.prisma.$transaction(async tx => {
      const updated = await tx.deal.updateMany({
        where: { id, tenantId: user.tenantId, stage: deal.stage, updatedAt: deal.updatedAt },
        data: { stage,
          closedAt: stage === 'WON' || stage === 'LOST' ? new Date() : null,
          lossReason: stage === 'LOST' ? lossReason!.trim() : null,
        },
      });
      if (updated.count !== 1) throw new ConflictException('Deal changed. Refresh and try again');
      await tx.dealStageHistory.create({ data: {
        dealId: id, tenantId: user.tenantId, fromStage: deal.stage,
        toStage: stage, changedById: user.id,
        reason: stage === 'LOST' ? lossReason!.trim() : null,
      } });
      await this.audit.record(tx,{actor:user,module:'CRM',action:'DEAL_STAGE_CHANGED',companyId:deal.companyId,branchId:deal.branchId??undefined,targetId:id,changes:{from:deal.stage,to:stage}});
      return tx.deal.findUniqueOrThrow({ where: { id } });
    });
  }
}
