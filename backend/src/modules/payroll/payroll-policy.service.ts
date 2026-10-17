
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  CompanyPayrollPolicy,
  MissingAttendanceAction,
  PayrollCalculationMode,
  PayrollDayBasis,
  PayrollStatus,
  Prisma,
  RecordStatus,
} from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';

import {
  CreatePayrollPolicyDto,
  ResolvePayrollPolicyDto,
} from './dto/payroll-policy.dto';

export interface PayrollPolicyAuthUser {
  id: string;
  tenantId: string;
  roles: string[];
}

@Injectable()
export class PayrollPolicyService {
  constructor(private readonly prisma: PrismaService) {}

  private ensureAdmin(user: PayrollPolicyAuthUser): void {
    if (
      !user?.id ||
      !user?.tenantId ||
      !user.roles?.some((role) =>
        ['BUSINESS_OWNER', 'BUSINESS_ADMIN', 'PAYROLL_MANAGER'].includes(role),
      )
    ) {
      throw new ForbiddenException(
        'Business payroll administrator access required',
      );
    }
  }

  private async ensureCompanyAccess(
    user: PayrollPolicyAuthUser,
    companyId: string,
  ): Promise<void> {
    this.ensureAdmin(user);

    const company = await this.prisma.company.findFirst({
      where: {
        id: companyId,
        tenantId: user.tenantId,
        status: RecordStatus.ACTIVE,
      },
      select: { id: true },
    });

    if (!company) {
      throw new NotFoundException('Active company not found');
    }

    if (user.roles.includes('BUSINESS_OWNER')) {
      return;
    }

    const access = await this.prisma.userCompanyAccess.findUnique({
      where: {
        userId_companyId: {
          userId: user.id,
          companyId,
        },
      },
      select: { userId: true },
    });

    if (!access) {
      throw new ForbiddenException('Company access denied');
    }
  }

  private parseDate(value: string): Date {
    if (
      typeof value !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}$/.test(value)
    ) {
      throw new BadRequestException(
        'Date must use YYYY-MM-DD',
      );
    }

    const date = new Date(`${value}T00:00:00.000Z`);

    if (
      Number.isNaN(date.getTime()) ||
      date.toISOString().slice(0, 10) !== value
    ) {
      throw new BadRequestException('Invalid calendar date');
    }

    return date;
  }

  private monthEnd(date: Date): Date {
    return new Date(
      Date.UTC(
        date.getUTCFullYear(),
        date.getUTCMonth() + 1,
        0,
      ),
    );
  }

  private previousDay(date: Date): Date {
    return new Date(date.getTime() - 86_400_000);
  }

  private validatePeriod(
    start: Date,
    end: Date | null,
  ): void {
    if (start.getUTCDate() !== 1) {
      throw new BadRequestException(
        'effectiveFrom must be the first day of a month',
      );
    }

    if (end) {
      if (end < start) {
        throw new BadRequestException(
          'effectiveTo must be on or after effectiveFrom',
        );
      }

      if (
        end.getTime() !==
        this.monthEnd(end).getTime()
      ) {
        throw new BadRequestException(
          'effectiveTo must be the last day of a month',
        );
      }
    }
  }

  async create(
    user: PayrollPolicyAuthUser,
    dto: CreatePayrollPolicyDto,
  ): Promise<CompanyPayrollPolicy> {
    await this.ensureCompanyAccess(
      user,
      dto.companyId,
    );

    const start = this.parseDate(dto.effectiveFrom);
    const end = dto.effectiveTo
      ? this.parseDate(dto.effectiveTo)
      : null;

    this.validatePeriod(start, end);

    if (
      dto.halfDayDeduction !== undefined &&
      !/^(0(\.\d{1,2})?|1(\.0{1,2})?)$/.test(
        dto.halfDayDeduction,
      )
    ) {
      throw new BadRequestException(
        'halfDayDeduction must be between 0 and 1',
      );
    }

    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const company = await tx.company.findFirst({
            where: {
              id: dto.companyId,
              tenantId: user.tenantId,
              status: RecordStatus.ACTIVE,
            },
            select: { id: true },
          });

          if (!company) {
            throw new NotFoundException(
              'Active company not found',
            );
          }

          const latest =
            await tx.companyPayrollPolicy.findFirst({
              where: {
                tenantId: user.tenantId,
                companyId: dto.companyId,
              },
              orderBy: { version: 'desc' },
            });

          if (
            latest &&
            start <= latest.effectiveFrom
          ) {
            throw new ConflictException(
              'A new policy must start after the latest policy',
            );
          }

          // Never introduce or change a policy in a period
          // that already has calculated/finalized payroll.
          const protectedRuns = await tx.payrollRun.count({
            where: {
              tenantId: user.tenantId,
              companyId: dto.companyId,
              status: {
                in: [
                  PayrollStatus.CALCULATED,
                  PayrollStatus.APPROVED,
                  PayrollStatus.PAID,
                ],
              },
              period: {
                endDate: { gte: start },
                ...(end
                  ? {
                      startDate: { lte: end },
                    }
                  : {}),
              },
            },
          });

          if (protectedRuns > 0) {
            throw new ConflictException(
              'Cannot change policy for a calculated, approved or paid payroll period',
            );
          }

          const overlaps =
            await tx.companyPayrollPolicy.findMany({
              where: {
                tenantId: user.tenantId,
                companyId: dto.companyId,
                effectiveFrom: {
                  lte:
                    end ??
                    new Date('9999-12-31T00:00:00.000Z'),
                },
                OR: [
                  { effectiveTo: null },
                  { effectiveTo: { gte: start } },
                ],
              },
              orderBy: { effectiveFrom: 'asc' },
            });

          if (overlaps.length > 1) {
            throw new ConflictException(
              'Multiple policies overlap the requested period',
            );
          }

          const overlapping = overlaps[0];

          if (overlapping) {
            const canClosePrevious =
              latest !== null &&
              overlapping.id === latest.id &&
              overlapping.effectiveTo === null &&
              overlapping.effectiveFrom < start;

            if (!canClosePrevious) {
              throw new ConflictException(
                'The requested policy overlaps an existing policy',
              );
            }

            const closingDate = this.previousDay(start);

            // Only shorten a current open-ended policy.
            // Do not rewrite its rules, mode or version.
            const closed =
              await tx.companyPayrollPolicy.updateMany({
                where: {
                  id: overlapping.id,
                  tenantId: user.tenantId,
                  companyId: dto.companyId,
                  effectiveTo: null,
                },
                data: {
                  effectiveTo: closingDate,
                },
              });

            if (closed.count !== 1) {
              throw new ConflictException(
                'Existing policy changed; reload and retry',
              );
            }
          }

          return tx.companyPayrollPolicy.create({
            data: {
              tenantId: user.tenantId,
              companyId: dto.companyId,
              mode: dto.mode,
              dayBasis:
                dto.dayBasis ??
                PayrollDayBasis.CALENDAR_DAYS,
              missingAttendanceAction:
                dto.missingAttendanceAction ??
                MissingAttendanceAction.BLOCK_CALCULATION,
              halfDayDeduction: new Prisma.Decimal(
                dto.halfDayDeduction ?? '0.50',
              ),
              deductUnpaidLeave:
                dto.deductUnpaidLeave ?? true,
              deductAbsentDays:
                dto.deductAbsentDays ?? true,
              effectiveFrom: start,
              effectiveTo: end,
              version: (latest?.version ?? 0) + 1,
            },
          });
        },
        {
          isolationLevel:
            Prisma.TransactionIsolationLevel.Serializable,
        },
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        ['P2002', 'P2034'].includes(error.code)
      ) {
        throw new ConflictException(
          'Concurrent payroll policy modification. Reload and retry.',
        );
      }

      throw error;
    }
  }

  async list(
    user: PayrollPolicyAuthUser,
    companyId: string,
  ): Promise<CompanyPayrollPolicy[]> {
    await this.ensureCompanyAccess(user, companyId);

    return this.prisma.companyPayrollPolicy.findMany({
      where: {
        tenantId: user.tenantId,
        companyId,
      },
      orderBy: { version: 'desc' },
    });
  }

  async resolve(
    user: PayrollPolicyAuthUser,
    dto: ResolvePayrollPolicyDto,
  ) {
    await this.ensureCompanyAccess(
      user,
      dto.companyId,
    );

    if (
      !Number.isInteger(dto.year) ||
      !Number.isInteger(dto.month) ||
      dto.year < 2000 ||
      dto.year > 2100 ||
      dto.month < 1 ||
      dto.month > 12
    ) {
      throw new BadRequestException(
        'Invalid payroll year or month',
      );
    }

    const monthStart = new Date(
      Date.UTC(dto.year, dto.month - 1, 1),
    );

    const monthEnd = this.monthEnd(monthStart);

    const policies =
      await this.prisma.companyPayrollPolicy.findMany({
        where: {
          tenantId: user.tenantId,
          companyId: dto.companyId,
          effectiveFrom: { lte: monthEnd },
          OR: [
            { effectiveTo: null },
            { effectiveTo: { gte: monthStart } },
          ],
        },
        orderBy: { version: 'desc' },
      });

    if (policies.length > 1) {
      throw new ConflictException(
        'Multiple payroll policies overlap this month',
      );
    }

    const policy = policies[0];

    if (policy) {
      if (
        policy.effectiveFrom > monthStart ||
        (policy.effectiveTo &&
          policy.effectiveTo < monthEnd)
      ) {
        throw new ConflictException(
          'Partial-month payroll policies are not supported',
        );
      }

      return {
        configured: true,
        policy,
      };
    }

    // Virtual fallback. No database row is created.
    return {
      configured: false,
      policy: {
        id: null,
        tenantId: user.tenantId,
        companyId: dto.companyId,
        mode: PayrollCalculationMode.FIXED,
        dayBasis: PayrollDayBasis.CALENDAR_DAYS,
        missingAttendanceAction:
          MissingAttendanceAction.BLOCK_CALCULATION,
        halfDayDeduction: '0.50',
        deductUnpaidLeave: true,
        deductAbsentDays: true,
        effectiveFrom: null,
        effectiveTo: null,
        version: 0,
      },
    };
  }
}
