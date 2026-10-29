import { assertCompanyScope } from '../../common/company-scope';
import { DisburseAdvanceDto } from './dto/advances.dto';

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import {
  EmploymentStatus,
  Prisma,
  RecordStatus,
  SalaryAdvanceStatus,
  UserStatus,
} from "@prisma/client";

import { PrismaService } from "../../prisma/prisma.service";

import {
  CreateAdvanceDto,
  ReviewAdvanceDto,
} from "./dto/advances.dto";

export interface AdvanceAuthUser {
  id: string;
  tenantId: string;
  roles: string[]; companyId?: string;
}

@Injectable()
export class AdvancesService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  // ===================================================
  // AUTHENTICATION
  // ===================================================

  private requireLogin(
    user: AdvanceAuthUser,
  ): void {
    if (!user?.id || !user?.tenantId) {
      throw new ForbiddenException(
        "Tenant login required",
      );
    }
  }

  private requireAdmin(
    user: AdvanceAuthUser,
  ): void {
    this.requireLogin(user);

    if (
      !user.roles?.some((role) =>
        [
          "BUSINESS_OWNER",
          "BUSINESS_ADMIN",
          "PAYROLL_MANAGER", "COMPANY_MANAGER", "BRANCH_MANAGER", "HR_MANAGER",
        ].includes(role),
      )
    ) {
      throw new ForbiddenException(
        "Business administrator access required",
      );
    }
  }

  // ===================================================
  // COMPANY / BRANCH AUTHORIZATION
  // ===================================================

  private async authorizeAdminBranch(
    user: AdvanceAuthUser,
    companyId: string,
    branchId: string,
  ): Promise<void> {
    this.requireAdmin(user);

    assertCompanyScope(user, companyId);
    const branch = await this.prisma.branch.findFirst({
      where: {
        id: branchId,
        companyId,
        status: RecordStatus.ACTIVE,
        company: {
          tenantId: user.tenantId,
          status: RecordStatus.ACTIVE,
        },
      },
      select: {
        id: true,
      },
    });

    if (!branch) {
      throw new NotFoundException(
        "Active company branch not found",
      );
    }

    if (
      user.roles.includes("BUSINESS_OWNER")
    ) {
      return;
    }

    const [companyAccess, branchAccess] =
      await Promise.all([
        this.prisma.userCompanyAccess.findUnique({
          where: {
            userId_companyId: {
              userId: user.id,
              companyId,
            },
          },
          select: { userId: true },
        }),

        this.prisma.userBranchAccess.findUnique({
          where: {
            userId_branchId: {
              userId: user.id,
              branchId,
            },
          },
          select: { userId: true },
        }),
      ]);

    if (!companyAccess || !branchAccess) {
      throw new ForbiddenException(
        "Company or branch access denied",
      );
    }
  }

  // ===================================================
  // EMPLOYEE WORK CONTEXTS
  // ===================================================

  async myContexts(user: AdvanceAuthUser) {
    this.requireLogin(user);

    const profiles =
      await this.prisma.employeeProfile.findMany({
        where: {
          tenantId: user.tenantId,
          userId: user.id,
          status: EmploymentStatus.ACTIVE,

          user: {
            status: UserStatus.ACTIVE,
          },

          company: {
            tenantId: user.tenantId,
            status: RecordStatus.ACTIVE,
            userAccess: {
              some: {
                userId: user.id,
              },
            },
          },

          branch: {
            status: RecordStatus.ACTIVE,
            userAccess: {
              some: {
                userId: user.id,
              },
            },
          },
        },

        select: {
          id: true,
          companyId: true,
          branchId: true,
          employeeCode: true,
          company: {
            select: {
              name: true,
            },
          },
          branch: {
            select: {
              name: true,
            },
          },
        },

        orderBy: {
          createdAt: "asc",
        },
      });

    return profiles;
  }

  private async requireEmployeeContext(
    user: AdvanceAuthUser,
    companyId: string,
    branchId: string,
  ) {
    const contexts = await this.myContexts(user);

    const context = contexts.find(
      (item) =>
        item.companyId === companyId &&
        item.branchId === branchId,
    );

    if (!context) {
      throw new ForbiddenException(
        "You are not assigned as an active employee to this company and branch",
      );
    }

    return context;
  }

  // ===================================================
  // EMPLOYEE: CREATE REQUEST
  // ===================================================

  async create(
    user: AdvanceAuthUser,
    dto: CreateAdvanceDto,
  ) {
    this.requireLogin(user);

    await this.requireEmployeeContext(
      user,
      dto.companyId,
      dto.branchId,
    );

    const amountText =
      typeof dto.amount === "string"
        ? dto.amount.trim()
        : "";

    if (
      !/^\d{1,12}(\.\d{1,2})?$/.test(
        amountText,
      )
    ) {
      throw new BadRequestException(
        "Enter a valid positive amount with up to two decimal places",
      );
    }

    const amount =
      new Prisma.Decimal(amountText);

    if (amount.lte(0)) {
      throw new BadRequestException(
        "Advance amount must be greater than zero",
      );
    }

    const reason =
      typeof dto.reason === "string"
        ? dto.reason.trim()
        : "";

    if (
      reason.length < 3 ||
      reason.length > 1000
    ) {
      throw new BadRequestException(
        "Reason must contain between 3 and 1000 characters",
      );
    }

    return this.prisma.salaryAdvance.create({
      data: {
        tenantId: user.tenantId,
        companyId: dto.companyId,
        branchId: dto.branchId,
        userId: user.id,
        amount,
        reason,
        status: SalaryAdvanceStatus.PENDING,
      },
    });
  }

  // ===================================================
  // EMPLOYEE: MY REQUESTS
  // ===================================================

  async mine(user: AdvanceAuthUser) {
    this.requireLogin(user);

    return this.prisma.salaryAdvance.findMany({
      where: {
        tenantId: user.tenantId,
        userId: user.id,
      },

      include: {
        recoveries: { select: { amount: true, entry: { select: { payment: { select: { id: true, status: true } } } } } },
        company: {
          select: {
            id: true,
            name: true,
          },
        },

        branch: {
          select: {
            id: true,
            name: true,
          },
        },
      },

      orderBy: {
        createdAt: "desc",
      },

      take: 100,
    });
  }

  // ===================================================
  // ADMIN: LIST REQUESTS
  // ===================================================

  async disburse(user: AdvanceAuthUser, id: string, dto: DisburseAdvanceDto) {
    this.requireAdmin(user);
    if (!user.roles.some(role => ["BUSINESS_OWNER", "BUSINESS_ADMIN", "PAYROLL_MANAGER"].includes(role))) throw new ForbiddenException("Payroll payout access required");
    const advance = await this.prisma.salaryAdvance.findFirst({ where: { id, tenantId: user.tenantId } });
    if (!advance) throw new NotFoundException('Advance not found');
    await this.authorizeAdminBranch(user, advance.companyId, advance.branchId);
    if (advance.userId === user.id) throw new ForbiddenException('You cannot record your own advance payout.');
    const monthly = new Prisma.Decimal(dto.recoveryMonthly);
    if (monthly.lessThanOrEqualTo(0) || monthly.greaterThan(advance.amount)) throw new BadRequestException('Monthly recovery must be positive and cannot exceed the advance.');
    if (dto.reference.trim().length < 3) throw new BadRequestException('A payout reference is required.');
    const now = new Date();
    const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit' }).formatToParts(now);
    const currentMonth = parts.find(item => item.type === 'year')!.value + '-' + parts.find(item => item.type === 'month')!.value;
    if (dto.recoveryStart < currentMonth) throw new BadRequestException('Recovery cannot start before the payout month.');
    return this.prisma.$transaction(async tx => {
      const result = await tx.salaryAdvance.updateMany({ where: { id, status: 'APPROVED', disbursedAt: null }, data: {
        disbursedAt: now, disbursedById: user.id, paymentReference: dto.reference.trim(), recoveryMonthly: monthly, recoveryStart: dto.recoveryStart,
      } });
      if (!result.count) throw new ConflictException('Only an approved advance without a recorded payout can be disbursed.');
      await tx.auditEvent.create({ data: { tenantId: user.tenantId, companyId: advance.companyId, branchId: advance.branchId, actorId: user.id, module: 'ADVANCES', action: 'ADVANCE_PAYOUT_RECORDED', targetId: id, detail: 'Manual advance payout recorded; monthly payroll recovery scheduled', changes: { recoveryStart: dto.recoveryStart, recoveryMonthly: monthly.toFixed(2) } } });
      return tx.salaryAdvance.findUniqueOrThrow({ where: { id } });
    });
  }

  async list(
    user: AdvanceAuthUser,
    companyId: string,
    branchId: string,
  ) {
    await this.authorizeAdminBranch(
      user,
      companyId,
      branchId,
    );

    return this.prisma.salaryAdvance.findMany({
      where: {
        tenantId: user.tenantId,
        companyId,
        branchId,
      },

      include: {
        recoveries: { select: { amount: true, entry: { select: { payment: { select: { id: true, status: true } } } } } },
        employee: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },

        reviewedBy: {
          select: {
            id: true,
            name: true,
          },
        },
      },

      orderBy: {
        createdAt: "desc",
      },

      take: 200,
    });
  }

  // ===================================================
  // ADMIN: REVIEW REQUEST
  // ===================================================

  private async review(
    user: AdvanceAuthUser,
    id: string,
    status:
  | "APPROVED"
  | "REJECTED",
    dto: ReviewAdvanceDto,
  ) {
    this.requireAdmin(user);
    if (!user.roles.some(role => ["BUSINESS_OWNER", "BUSINESS_ADMIN", "COMPANY_MANAGER", "BRANCH_MANAGER", "HR_MANAGER"].includes(role))) throw new ForbiddenException("Manager or HR approval access required");

    const advance =
      await this.prisma.salaryAdvance.findFirst({
        where: {
          id,
          tenantId: user.tenantId,
        },
        select: {
          id: true,
          companyId: true,
          branchId: true,
          status: true,
          userId: true,
        },
      });

    if (!advance) {
      throw new NotFoundException(
        "Advance request not found",
      );
    }

    await this.authorizeAdminBranch(
      user,
      advance.companyId,
      advance.branchId,
    );

    if (advance.userId === user.id) {
      throw new ForbiddenException(
        "You cannot approve or reject your own advance request",
      );
    }

    if (
      advance.status !==
      SalaryAdvanceStatus.PENDING
    ) {
      throw new ConflictException(
        "Only pending advances can be reviewed",
      );
    }

    const note =
      typeof dto?.note === "string"
        ? dto.note.trim()
        : "";

    if (note.length > 1000) {
      throw new BadRequestException(
        "Review note is too long",
      );
    }

    const updated =
      await this.prisma.salaryAdvance.updateMany({
        where: {
          id,
          tenantId: user.tenantId,
          status: SalaryAdvanceStatus.PENDING,
        },

        data: {
          status,
          reviewedById: user.id,
          reviewedAt: new Date(),
          reviewNote: note || null,
        },
      });

    if (updated.count !== 1) {
      throw new ConflictException(
        "Advance request changed. Refresh and retry.",
      );
    }

    return this.prisma.salaryAdvance.findUniqueOrThrow({
      where: { id },
      include: {
        employee: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  approve(
    user: AdvanceAuthUser,
    id: string,
    dto: ReviewAdvanceDto,
  ) {
    return this.review(
      user,
      id,
      SalaryAdvanceStatus.APPROVED,
      dto,
    );
  }

  reject(
    user: AdvanceAuthUser,
    id: string,
    dto: ReviewAdvanceDto,
  ) {
    return this.review(
      user,
      id,
      SalaryAdvanceStatus.REJECTED,
      dto,
    );
  }

  // ===================================================
  // EMPLOYEE: CANCEL REQUEST
  // ===================================================

  async cancel(
    user: AdvanceAuthUser,
    id: string,
  ) {
    this.requireLogin(user);

    const updated =
      await this.prisma.salaryAdvance.updateMany({
        where: {
          id,
          tenantId: user.tenantId,
          userId: user.id,
          status: SalaryAdvanceStatus.PENDING,
        },

        data: {
          status: SalaryAdvanceStatus.CANCELLED,
        },
      });

    if (updated.count !== 1) {
      throw new ConflictException(
        "Request not found or no longer pending",
      );
    }

    return this.prisma.salaryAdvance.findUniqueOrThrow({
      where: { id },
    });
  }
}
