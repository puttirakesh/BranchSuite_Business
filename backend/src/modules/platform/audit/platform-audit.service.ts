import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../../prisma/prisma.service";
import { ListPlatformAuditDto } from "./dto/list-platform-audit.dto";

@Injectable()
export class PlatformAuditService {
  constructor(private readonly prisma: PrismaService) {}

  private dateRange(
    q: ListPlatformAuditDto,
  ): Prisma.DateTimeFilter | undefined {
    const parse = (value?: string): Date | undefined => {
      if (!value) return undefined;
      // Require date-only UTC boundaries, no implicit local timezone interpretation.
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value))
        throw new BadRequestException("Dates must use YYYY-MM-DD");
      const date = new Date(`${value}T00:00:00.000Z`);
      if (
        !Number.isFinite(date.getTime()) ||
        date.toISOString().slice(0, 10) !== value
      )
        throw new BadRequestException("Invalid calendar date");
      return date;
    };
    const start = parse(q.from);
    const end = parse(q.to);
    if (start && end && start > end)
      throw new BadRequestException("from must be on or before to");
    if (!start && !end) return undefined;
    // to is inclusive of its entire UTC calendar day.
    const exclusiveEnd = end ? new Date(end.getTime() + 86400000) : undefined;
    return {
      ...(start ? { gte: start } : {}),
      ...(exclusiveEnd ? { lt: exclusiveEnd } : {}),
    };
  }

  private where(q: ListPlatformAuditDto): Prisma.AuditEventWhereInput {
    return {
      ...(q.tenantId ? { tenantId: q.tenantId } : {}),
      ...(q.companyId ? { companyId: q.companyId } : {}),
      ...(q.branchId ? { branchId: q.branchId } : {}),
      ...(q.actorId ? { actorId: q.actorId } : {}),
      ...(q.module ? { module: q.module } : {}),
      ...(q.action ? { action: q.action } : {}),
      ...(q.targetId ? { targetId: q.targetId } : {}),
      ...(q.from || q.to ? { createdAt: this.dateRange(q) } : {}),
    };
  }

  async list(q: ListPlatformAuditDto) {
    const page = q.page ?? 1;
    const limit = q.limit ?? 25;
    const where = this.where(q);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.auditEvent.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.auditEvent.count({ where }),
    ]);
    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async summary(q: ListPlatformAuditDto) {
    const where = this.where(q);
    const [total, byModule, byAction] = await this.prisma.$transaction([
      this.prisma.auditEvent.count({ where }),
      this.prisma.auditEvent.groupBy({
        by: ["module"],
        where,
        _count: { _all: true },
        orderBy: { module: "asc" },
      }),
      this.prisma.auditEvent.groupBy({
        by: ["action"],
        where,
        _count: { _all: true },
        orderBy: { action: "asc" },
      }),
    ]);

    return {
      total,
      byModule: byModule.map((x) => ({
        module: x.module,
        count:
          typeof x._count === "object" && x._count !== null
            ? (x._count._all ?? 0)
            : 0,
      })),
      byAction: byAction.map((x) => ({
        action: x.action,
        count:
          typeof x._count === "object" && x._count !== null
            ? (x._count._all ?? 0)
            : 0,
      })),
    };
  }

  async modules() {
    const values = await this.prisma.auditEvent.groupBy({
      by: ["module"],
      _count: { _all: true },
      orderBy: { module: "asc" },
    });
    return values.map((x) => ({ module: x.module, count: x._count._all }));
  }

  async getOne(id: string) {
    const event = await this.prisma.auditEvent.findUnique({ where: { id } });
    if (!event) throw new NotFoundException("Audit event not found");
    return event;
  }
}
