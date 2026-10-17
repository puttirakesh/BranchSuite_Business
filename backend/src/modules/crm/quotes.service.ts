import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { DealActor, DealsService } from './deals.service';
import { CreateQuoteDto, QuoteItemDto, QuoteStatus, UpdateQuoteDto } from './dto/quote.dto';

@Injectable()
export class QuotesService {
  constructor(private readonly prisma: PrismaService, private readonly deals: DealsService, private readonly audit: AuditService) {}
  private readonly include = { items: { orderBy: { position: 'asc' as const } } };
  private lines(items: QuoteItemDto[]) {
    return items.map((item, position) => {
      if (!item.description.trim()) throw new BadRequestException('Item description is required');
      const price = new Prisma.Decimal(item.unitPrice);
      if (price.isNegative() || price.isNaN()) throw new BadRequestException('Invalid unit price');
      const total = price.mul(item.quantity);
      if (total.greaterThan('9999999999999999.99')) throw new BadRequestException('Line total too large');
      return { position, description: item.description.trim(), quantity: item.quantity, unitPrice: price, lineTotal: total };
    });
  }
  private sum(lines: ReturnType<QuotesService['lines']>) {
    const total = lines.reduce((acc, row)=>acc.plus(row.lineTotal), new Prisma.Decimal(0));
    if (total.greaterThan('9999999999999999.99')) throw new BadRequestException('Quote total too large');
    return total;
  }
  private async accessible(actor: DealActor, id: string) {
    const quote = await this.prisma.quote.findFirst({where:{id,tenantId:actor.tenantId},include:this.include});
    if (!quote) throw new NotFoundException('Quote not found');
    await this.deals.get(actor,quote.dealId);
    return quote;
  }
  async list(actor:DealActor,dealId:string) {
    await this.deals.get(actor,dealId);
    return this.prisma.quote.findMany({where:{dealId,tenantId:actor.tenantId},include:this.include,orderBy:{createdAt:'desc'}});
  }
  async listCompany(actor: DealActor, companyId?: string, branchId?: string) {
    if (!companyId) throw new BadRequestException('Provide a dealId or companyId');
    const deals = await this.deals.list(actor, companyId, branchId);
    return this.prisma.quote.findMany({
      where: { tenantId: actor.tenantId, companyId, dealId: { in: deals.map(deal => deal.id) } },
      include: this.include, orderBy: { createdAt: 'desc' },
    });
  }
  async get(actor:DealActor,id:string) {return this.accessible(actor,id);}
  async create(actor:DealActor,dto:CreateQuoteDto) {
    if (!dto.title.trim()) throw new BadRequestException('Quote title is required');
    const deal = await this.deals.get(actor,dto.dealId);
    if (deal.stage==='LOST') throw new ConflictException('Cannot quote a lost deal');
    const lines=this.lines(dto.items);const total=this.sum(lines);
    return this.prisma.$transaction(async tx=>{
      const quote=await tx.quote.create({data:{tenantId:actor.tenantId,companyId:deal.companyId,branchId:deal.branchId,dealId:deal.id,createdById:actor.id,title:dto.title.trim(),notes:dto.notes?.trim()||null,currency:deal.currency,total,items:{create:lines}},include:this.include});
      await this.audit.record(tx,{actor,module:'CRM',action:'QUOTE_CREATED',companyId:deal.companyId,branchId:deal.branchId??undefined,targetId:quote.id,changes:{dealId:deal.id,items:lines.length}});
      return quote;
    });
  }
  async update(actor:DealActor,id:string,dto:UpdateQuoteDto) {
    if (!dto.title.trim()) throw new BadRequestException('Quote title is required');
    const old=await this.accessible(actor,id);
    if(old.status!=='DRAFT')throw new ConflictException('Only draft quotes can be edited');
    const lines=this.lines(dto.items);const total=this.sum(lines);
    return this.prisma.$transaction(async tx=>{
      const updated=await tx.quote.updateMany({where:{id,tenantId:actor.tenantId,status:'DRAFT',version:dto.expectedVersion},data:{title:dto.title.trim(),notes:dto.notes?.trim()||null,total,version:{increment:1}}});
      if(updated.count!==1) throw new ConflictException('Quote was modified; refresh and try again');
      await tx.quoteItem.deleteMany({where:{quoteId:id}});
      await tx.quoteItem.createMany({data:lines.map(line=>({...line,quoteId:id}))});
      await this.audit.record(tx,{actor,module:'CRM',action:'QUOTE_UPDATED',companyId:old.companyId,branchId:old.branchId??undefined,targetId:id,changes:{items:lines.length,version:dto.expectedVersion+1}});
      return tx.quote.findUniqueOrThrow({where:{id},include:this.include});
    });
  }
  async changeStatus(actor:DealActor,id:string,status:QuoteStatus,expectedVersion:number) {
    const old=await this.accessible(actor,id);
    const allowed:Record<string,string[]>={DRAFT:['SENT','CANCELLED'],SENT:['ACCEPTED','REJECTED','CANCELLED'],ACCEPTED:[],REJECTED:[],CANCELLED:[]};
    if(!allowed[old.status]?.includes(status))throw new BadRequestException('Invalid quote status transition');
    return this.prisma.$transaction(async tx=>{
      const updated=await tx.quote.updateMany({where:{id,tenantId:actor.tenantId,status:old.status,version:expectedVersion},data:{status,version:{increment:1}}});
      if(updated.count!==1)throw new ConflictException('Quote was modified; refresh and retry');
      await this.audit.record(tx,{actor,module:'CRM',action:'QUOTE_STATUS_CHANGED',companyId:old.companyId,branchId:old.branchId??undefined,targetId:id,changes:{from:old.status,to:status}});
      return tx.quote.findUniqueOrThrow({where:{id},include:this.include});
    });
  }
}
