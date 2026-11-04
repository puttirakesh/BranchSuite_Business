import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../../prisma/prisma.service";
import {
  CreateMarketingOfferDto,
  ListOffersDto,
  UpdateMarketingOfferDto,
  UpdateOfferStatusDto,
} from "./dto/marketing.dto";

@Injectable()
export class PlatformMarketingService {
  constructor(private readonly prisma: PrismaService) {}

  private dates(start: string | Date, end: string | Date) {
    const startsAt = new Date(start);
    const endsAt = new Date(end);
    if (
      !Number.isFinite(startsAt.getTime()) ||
      !Number.isFinite(endsAt.getTime()) ||
      startsAt >= endsAt
    ) {
      throw new BadRequestException("startsAt must precede endsAt");
    }
    return { startsAt, endsAt };
  }

  private async validateScope(
    tenantId: string | null,
    companyId: string | null,
  ) {
    if (companyId && !tenantId)
      throw new BadRequestException(
        "tenantId is required when companyId is provided",
      );
    if (tenantId) {
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { id: true },
      });
      if (!tenant) throw new BadRequestException("Unknown tenantId");
    }
    if (companyId) {
      const company = await this.prisma.company.findFirst({
        where: { id: companyId, tenantId: tenantId! },
        select: { id: true },
      });
      if (!company)
        throw new BadRequestException("companyId does not belong to tenantId");
    }
  }

  private async get(id: string) {
    const offer = await this.prisma.marketingOffer.findUnique({
      where: { id },
    });
    if (!offer) throw new NotFoundException("Marketing offer not found");
    return offer;
  }

  async summary() {
    const grouped = await this.prisma.marketingOffer.groupBy({
      by: ["status"],
      _count: { id: true },
    });
    const byStatus = Object.fromEntries(
      ["DRAFT", "ACTIVE", "PAUSED", "ARCHIVED"].map((s) => [s, 0]),
    );
    for (const row of grouped) byStatus[row.status] = row._count.id;
    return {
      total: grouped.reduce((sum, row) => sum + row._count.id, 0),
      byStatus,
    };
  }

  async list(query: ListOffersDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    if (!Number.isSafeInteger(page) || page > 100000)
      throw new BadRequestException("Invalid page");
    const where: Prisma.MarketingOfferWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.discountType ? { discountType: query.discountType } : {}),
      ...(query.tenantId ? { tenantId: query.tenantId } : {}),
      ...(query.companyId ? { companyId: query.companyId } : {}),
      ...(query.search
        ? {
            OR: [
              { title: { contains: query.search, mode: "insensitive" } },
              { code: { contains: query.search, mode: "insensitive" } },
            ],
          }
        : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.marketingOffer.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.marketingOffer.count({ where }),
    ]);
    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  detail(id: string) {
    return this.get(id);
  }

  async history(id: string) {
    await this.get(id);
    return this.prisma.marketingOfferChange.findMany({
      where: { offerId: id },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 100,
    });
  }

  async create(dto: CreateMarketingOfferDto, actorId: string) {
    const { startsAt, endsAt } = this.dates(dto.startsAt, dto.endsAt);
    if (dto.discountType === "PERCENT" && dto.discountValue > 100)
      throw new BadRequestException("Percent discount cannot exceed 100");
    const tenantId = dto.tenantId ?? null;
    const companyId = dto.companyId ?? null;
    await this.validateScope(tenantId, companyId);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const offer = await tx.marketingOffer.create({
          data: {
            title: dto.title.trim(),
            description: dto.description.trim(),
            code: dto.code,
            discountType: dto.discountType,
            discountValue: new Prisma.Decimal(dto.discountValue),
            startsAt,
            endsAt,
            tenantId,
            companyId,
            usageLimit: dto.usageLimit ?? null,
            status: "DRAFT",
            createdById: actorId,
            updatedById: actorId,
          },
        });
        await tx.marketingOfferChange.create({
          data: {
            offerId: offer.id,
            actorId,
            action: "CREATED",
            changes: { status: "DRAFT" },
          },
        });
        return offer;
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      )
        throw new ConflictException("Offer code already exists");
      throw error;
    }
  }

  async update(id: string, dto: UpdateMarketingOfferDto, actorId: string) {
    const patch = Object.fromEntries(
      Object.entries(dto).filter(([, value]) => value !== undefined),
    );
    if (!Object.keys(patch).length)
      throw new BadRequestException("Provide at least one field");
    return this.prisma.$transaction(async (tx) => {
      // Serialize updates to the same offer to avoid lost updates and mismatched history.
      await tx.$queryRaw`SELECT id FROM "MarketingOffer" WHERE id = ${id} FOR UPDATE`;
      const current = await tx.marketingOffer.findUnique({ where: { id } });
      if (!current) throw new NotFoundException("Marketing offer not found");
      if (current.status !== "DRAFT" && current.status !== "PAUSED")
        throw new ConflictException(
          "Only draft or paused offers can be edited",
        );
      const { startsAt, endsAt } = this.dates(
        dto.startsAt ?? current.startsAt,
        dto.endsAt ?? current.endsAt,
      );
      const data = {
        ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description.trim() }
          : {}),
        ...(dto.startsAt !== undefined ? { startsAt } : {}),
        ...(dto.endsAt !== undefined ? { endsAt } : {}),
        ...(dto.usageLimit !== undefined ? { usageLimit: dto.usageLimit } : {}),
        updatedById: actorId,
      };
      const updated = await tx.marketingOffer.update({ where: { id }, data });
      await tx.marketingOfferChange.create({
        data: {
          offerId: id,
          actorId,
          action: "UPDATED",
          changes: { fields: Object.keys(patch) },
        },
      });
      return updated;
    });
  }

  async changeStatus(id: string, dto: UpdateOfferStatusDto, actorId: string) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "MarketingOffer" WHERE id = ${id} FOR UPDATE`;
      const current = await tx.marketingOffer.findUnique({ where: { id } });
      if (!current) throw new NotFoundException("Marketing offer not found");
      const allowed: Record<string, string[]> = {
        DRAFT: ["ACTIVE", "ARCHIVED"],
        ACTIVE: ["PAUSED", "ARCHIVED"],
        PAUSED: ["ACTIVE", "ARCHIVED"],
        ARCHIVED: [],
      };
      if (!(allowed[current.status] ?? []).includes(dto.status))
        throw new ConflictException("Invalid status transition");
      if (dto.status === "ACTIVE" && current.endsAt <= new Date())
        throw new ConflictException("Cannot activate an expired offer");
      const updated = await tx.marketingOffer.update({
        where: { id },
        data: { status: dto.status, updatedById: actorId },
      });
      await tx.marketingOfferChange.create({
        data: {
          offerId: id,
          actorId,
          action: "STATUS_CHANGED",
          changes: { from: current.status, to: dto.status },
        },
      });
      return updated;
    });
  }
}
