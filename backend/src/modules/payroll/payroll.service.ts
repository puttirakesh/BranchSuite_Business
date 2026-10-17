import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import {
  MissingAttendanceAction,
  PayrollCalculationMode,
  PayrollDayBasis,
  PayrollPaymentMethod,
  PayrollStatus,
  Prisma,
  RecordStatus,
  SalaryComponentKind,
  UserStatus,
} from "@prisma/client";

import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../../prisma/prisma.service";

import {
  AssignEmployeeSalaryDto,
  CreatePayrollPeriodDto,
  CreateSalaryStructureDto,
  RecordPayrollPaymentDto,
  ReviseEmployeeSalaryDto,
} from "./dto/payroll.dto";

export interface PayrollAuthUser {
  id: string;
  tenantId: string;
  roles: string[];
}

const Decimal = Prisma.Decimal;

const PROTECTED_STATUSES: PayrollStatus[] = [
  PayrollStatus.APPROVED,
  PayrollStatus.PAID,
];

@Injectable()
export class PayrollService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // =====================================================
  // AUTHORIZATION
  // =====================================================

  private admin(user: PayrollAuthUser): void {
    if (
      !user?.id ||
      !user?.tenantId ||
      !user.roles?.some((role) =>
        ["BUSINESS_OWNER", "BUSINESS_ADMIN", "PAYROLL_MANAGER"].includes(role),
      )
    ) {
      throw new ForbiddenException(
        "Business payroll administrator access required",
      );
    }
  }

  private async company(
    user: PayrollAuthUser,
    companyId: string,
  ): Promise<void> {
    this.admin(user);

    const company = await this.prisma.company.findFirst({
      where: {
        id: companyId,
        tenantId: user.tenantId,
        status: RecordStatus.ACTIVE,
      },
      select: {
        id: true,
      },
    });

    if (!company) {
      throw new NotFoundException("Active company not found");
    }

    // Business owners can manage companies in their tenant.
    if (user.roles.includes("BUSINESS_OWNER")) {
      return;
    }

    // Business administrators must be assigned to the company.
    const access = await this.prisma.userCompanyAccess.findUnique({
      where: {
        userId_companyId: {
          userId: user.id,
          companyId,
        },
      },
      select: {
        userId: true,
      },
    });

    if (!access) {
      throw new ForbiddenException("Company access denied");
    }
  }

  private async branch(
    user: PayrollAuthUser,
    companyId: string,
    branchId: string,
  ): Promise<void> {
    await this.company(user, companyId);

    const branch = await this.prisma.branch.findFirst({
      where: {
        id: branchId,
        companyId,
        status: RecordStatus.ACTIVE,
      },
      select: {
        id: true,
      },
    });

    if (!branch) {
      throw new NotFoundException("Active branch not found for company");
    }

    // Owners have tenant-wide company access.
    if (user.roles.includes("BUSINESS_OWNER")) {
      return;
    }

    // Admins must also have explicit branch access.
    const branchAccess = await this.prisma.userBranchAccess.findUnique({
      where: {
        userId_branchId: {
          userId: user.id,
          branchId,
        },
      },
      select: {
        userId: true,
      },
    });

    if (!branchAccess) {
      throw new ForbiddenException("Branch access denied");
    }
  }

  private async employee(
    user: PayrollAuthUser,
    companyId: string,
    branchId: string,
    employeeId: string,
  ): Promise<void> {
    const employee = await this.prisma.user.findFirst({
      where: {
        id: employeeId,
        tenantId: user.tenantId,
        status: UserStatus.ACTIVE,
      },
      select: {
        id: true,
      },
    });

    if (!employee) {
      throw new NotFoundException("Active employee not found");
    }

    const [companyAccess, branchAccess] = await Promise.all([
      this.prisma.userCompanyAccess.findUnique({
        where: {
          userId_companyId: {
            userId: employeeId,
            companyId,
          },
        },
        select: {
          userId: true,
        },
      }),

      this.prisma.userBranchAccess.findUnique({
        where: {
          userId_branchId: {
            userId: employeeId,
            branchId,
          },
        },
        select: {
          userId: true,
        },
      }),
    ]);

    if (!companyAccess || !branchAccess) {
      throw new ForbiddenException(
        "Employee must be assigned to the company and branch",
      );
    }
  }

  // =====================================================
  // VALIDATION HELPERS
  // =====================================================

  private money(value: string, label: string): Prisma.Decimal {
    if (typeof value !== "string" || !/^\d{1,12}(\.\d{1,2})?$/.test(value)) {
      throw new BadRequestException(
        `${label} must be a non-negative decimal string with at most two decimal places`,
      );
    }

    return new Decimal(value);
  }

  private date(value: string): Date {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      throw new BadRequestException("Date must use YYYY-MM-DD");
    }

    const date = new Date(`${value}T00:00:00.000Z`);

    if (
      Number.isNaN(date.getTime()) ||
      date.toISOString().slice(0, 10) !== value
    ) {
      throw new BadRequestException("Invalid calendar date");
    }

    return date;
  }

  private isUniqueError(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    );
  }

  private isTransactionConflict(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2034"
    );
  }

  // =====================================================
  // SALARY STRUCTURES
  // =====================================================

  async createStructure(user: PayrollAuthUser, dto: CreateSalaryStructureDto) {
    await this.company(user, dto.companyId);

    if (
      !dto.name?.trim() ||
      !Array.isArray(dto.components) ||
      dto.components.length > 40
    ) {
      throw new BadRequestException(
        "Structure name and components array (maximum 40) are required",
      );
    }

    const currency = dto.currency ?? "INR";

    if (!/^[A-Z]{3}$/.test(currency)) {
      throw new BadRequestException("Use a valid 3-letter currency code");
    }

    const codes = new Set<string>();

    const components = dto.components.map((component) => {
      const code = component.code?.trim().toUpperCase();
      const name = component.name?.trim();

      if (!code || !/^[A-Z0-9_]{1,30}$/.test(code) || !name) {
        throw new BadRequestException(
          "Each component requires a valid code and name",
        );
      }

      if (codes.has(code) || code === "BASIC") {
        throw new BadRequestException(
          "Duplicate component code or reserved BASIC code",
        );
      }

      if (
        component.kind !== SalaryComponentKind.EARNING &&
        component.kind !== SalaryComponentKind.DEDUCTION
      ) {
        throw new BadRequestException("Invalid salary component kind");
      }

      codes.add(code);

      return {
        tenantId: user.tenantId,
        companyId: dto.companyId,
        code,
        name,
        kind: component.kind,
        amount: this.money(component.amount, code),
      };
    });

    try {
      return await this.prisma.salaryStructure.create({
        data: {
          tenantId: user.tenantId,
          companyId: dto.companyId,
          name: dto.name.trim(),
          currency,
          basicAmount: this.money(dto.basicAmount, "basicAmount"),
          components: {
            create: components,
          },
        },
        include: {
          components: true,
        },
      });
    } catch (error) {
      if (this.isUniqueError(error)) {
        throw new ConflictException("Salary structure name already exists");
      }

      throw error;
    }
  }

  async listStructures(user: PayrollAuthUser, companyId: string) {
    await this.company(user, companyId);

    return this.prisma.salaryStructure.findMany({
      where: {
        tenantId: user.tenantId,
        companyId,
      },
      include: {
        components: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });
  }

  // =====================================================
  // EMPLOYEE SALARY ASSIGNMENTS
  // =====================================================

  async assignSalary(user: PayrollAuthUser, dto: AssignEmployeeSalaryDto) {
    await this.branch(user, dto.companyId, dto.branchId);

    await this.employee(user, dto.companyId, dto.branchId, dto.userId);

    const structure = await this.prisma.salaryStructure.findFirst({
      where: {
        id: dto.structureId,
        tenantId: user.tenantId,
        companyId: dto.companyId,
        status: RecordStatus.ACTIVE,
      },
      select: {
        id: true,
      },
    });

    if (!structure) {
      throw new NotFoundException("Active salary structure not found");
    }

    const start = this.date(dto.effectiveFrom);
    const end = dto.effectiveTo ? this.date(dto.effectiveTo) : null;

    if (end && end < start) {
      throw new BadRequestException(
        "effectiveTo must be on or after effectiveFrom",
      );
    }

    const overlap = await this.prisma.employeeSalary.findFirst({
      where: {
        tenantId: user.tenantId,
        companyId: dto.companyId,
        branchId: dto.branchId,
        userId: dto.userId,
        effectiveFrom: {
          lte: end ?? new Date("9999-12-31T00:00:00.000Z"),
        },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: start } }],
      },
      select: {
        id: true,
      },
    });

    if (overlap) {
      throw new ConflictException(
        "Employee already has an overlapping salary assignment",
      );
    }

    // Prevent salary changes from being introduced into
    // previously calculated or finalized payroll months.
    const protectedPeriod = await this.prisma.payrollPeriod.findFirst({
      where: {
        tenantId: user.tenantId,
        companyId: dto.companyId,
        branchId: dto.branchId,
        endDate: { gte: start },
        ...(end ? { startDate: { lte: end } } : {}),
        run: {
          is: {
            status: {
              in: [
                PayrollStatus.CALCULATED,
                PayrollStatus.APPROVED,
                PayrollStatus.PAID,
              ],
            },
          },
        },
      },
      select: { id: true },
    });

    if (protectedPeriod) {
      throw new ConflictException(
        "Cannot introduce a salary assignment into an already calculated payroll period",
      );
    }

    try {
      return await this.prisma.employeeSalary.create({
        data: {
          tenantId: user.tenantId,
          companyId: dto.companyId,
          branchId: dto.branchId,
          userId: dto.userId,
          structureId: dto.structureId,
          effectiveFrom: start,
          effectiveTo: end,
          basicOverride:
            dto.basicOverride === undefined
              ? null
              : this.money(dto.basicOverride, "basicOverride"),
        },
        include: {
          structure: {
            include: {
              components: true,
            },
          },
        },
      });
    } catch (error) {
      if (this.isUniqueError(error)) {
        throw new ConflictException("Duplicate salary assignment start date");
      }

      throw error;
    }
  }

  // Salary revisions are effective on the first day of a future, unfinalized
  // payroll month. Historical assignment rows remain available for auditing.
  async reviseEmployeeSalary(
    user: PayrollAuthUser,
    dto: ReviseEmployeeSalaryDto,
  ) {
    await this.branch(user, dto.companyId, dto.branchId);
    await this.employee(user, dto.companyId, dto.branchId, dto.userId);

    const start = this.date(dto.effectiveFrom);
    if (start.getUTCDate() !== 1) {
      throw new BadRequestException(
        "Revision must start on the first of a month",
      );
    }

    const gross = this.money(dto.gross, "gross");
    const deductions = this.money(dto.deductions, "deductions");
    if (gross.lte(0) || deductions.gt(gross)) {
      throw new BadRequestException(
        "Gross must be positive and deductions cannot exceed gross",
      );
    }
    if (!dto.reason?.trim()) {
      throw new BadRequestException("A salary revision reason is required");
    }

    const previousDay = new Date(start);
    previousDay.setUTCDate(previousDay.getUTCDate() - 1);

    try {
      return await this.prisma.$transaction(
        async (tx) => {
          // Never modify effective salary coverage for a calculated or final run.
          const protectedPeriod = await tx.payrollPeriod.findFirst({
            where: {
              tenantId: user.tenantId,
              companyId: dto.companyId,
              branchId: dto.branchId,
              endDate: { gte: start },
              run: {
                is: {
                  status: {
                    in: [
                      PayrollStatus.CALCULATED,
                      PayrollStatus.APPROVED,
                      PayrollStatus.PAID,
                    ],
                  },
                },
              },
            },
            select: { id: true },
          });
          if (protectedPeriod) {
            throw new ConflictException(
              "A calculated or finalized payroll period overlaps this revision",
            );
          }

          // Forbid future salary assignments in any branch of this company.
          // Prevent conflicting employer obligations when an employee transfers.
          const future = await tx.employeeSalary.findFirst({
            where: {
              tenantId: user.tenantId,
              companyId: dto.companyId,
              userId: dto.userId,
              effectiveFrom: { gte: start },
            },
            select: { id: true },
          });
          if (future) {
            throw new ConflictException(
              "A salary assignment already starts on or after this revision date",
            );
          }

          const covering = await tx.employeeSalary.findMany({
            where: {
              tenantId: user.tenantId,
              companyId: dto.companyId,
              userId: dto.userId,
              effectiveFrom: { lte: start },
              OR: [{ effectiveTo: null }, { effectiveTo: { gte: start } }],
            },
            include: { structure: { include: { components: true } } },
          });
          if (covering.length !== 1 || covering[0].branchId !== dto.branchId) {
            throw new ConflictException(
              "Expected one existing salary assignment in the selected branch",
            );
          }
          const previous = covering[0];
          if (previous.effectiveFrom >= start || previous.effectiveTo) {
            throw new ConflictException(
              "Only an open-ended salary assignment can be revised for a later month",
            );
          }
          if (previous.structure.currency !== "INR") {
            throw new ConflictException(
              "This revision form supports INR salaries only",
            );
          }
          // Existing gross is replaced by the new basic amount; other structure
          // components are intentionally NOT copied to avoid counting them twice.
          const revisionName = `Revision ${dto.userId.slice(0, 8)} ${start.toISOString().slice(0, 10)}`;
          const structure = await tx.salaryStructure.create({
            data: {
              tenantId: user.tenantId,
              companyId: dto.companyId,
              name: revisionName,
              currency: "INR",
              basicAmount: gross,
              components: {
                create: deductions.gt(0)
                  ? [
                      {
                        tenantId: user.tenantId,
                        companyId: dto.companyId,
                        code: "DEDUCTIONS",
                        name: "Monthly deductions",
                        kind: SalaryComponentKind.DEDUCTION,
                        amount: deductions,
                      },
                    ]
                  : [],
              },
            },
          });

          await tx.employeeSalary.update({
            where: { id: previous.id },
            data: { effectiveTo: previousDay },
          });
          const assignment = await tx.employeeSalary.create({
            data: {
              tenantId: user.tenantId,
              companyId: dto.companyId,
              branchId: dto.branchId,
              userId: dto.userId,
              structureId: structure.id,
              effectiveFrom: start,
            },
            include: { structure: { include: { components: true } } },
          });
          // Note: the existing Prisma model has no dedicated audit table for
          // revision reasons. Return the reason; add a persistent audit trail
          // before using the feature for regulated/production payroll.
          return {
            assignment,
            previousAssignmentId: previous.id,
            reason: dto.reason.trim(),
          };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (this.isUniqueError(error) || this.isTransactionConflict(error)) {
        throw new ConflictException(
          "Salary revision conflict. Reload and retry.",
        );
      }
      throw error;
    }
  }

  async listAssignments(
    user: PayrollAuthUser,
    companyId: string,
    branchId: string,
  ) {
    await this.branch(user, companyId, branchId);

    return this.prisma.employeeSalary.findMany({
      where: {
        tenantId: user.tenantId,
        companyId,
        branchId,
      },
      include: {
        structure: {
          include: {
            components: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: [{ userId: "asc" }, { effectiveFrom: "desc" }],
    });
  }

  // =====================================================
  // PAYROLL PERIODS
  // =====================================================

  async createPeriod(user: PayrollAuthUser, dto: CreatePayrollPeriodDto) {
    await this.branch(user, dto.companyId, dto.branchId);

    if (
      !Number.isInteger(dto.year) ||
      dto.year < 2000 ||
      dto.year > 2100 ||
      !Number.isInteger(dto.month) ||
      dto.month < 1 ||
      dto.month > 12
    ) {
      throw new BadRequestException("Invalid payroll year or month");
    }

    const startDate = new Date(Date.UTC(dto.year, dto.month - 1, 1));

    const endDate = new Date(Date.UTC(dto.year, dto.month, 0));

    try {
      return await this.prisma.payrollPeriod.create({
        data: {
          tenantId: user.tenantId,
          companyId: dto.companyId,
          branchId: dto.branchId,
          year: dto.year,
          month: dto.month,
          startDate,
          endDate,
        },
      });
    } catch (error) {
      if (this.isUniqueError(error)) {
        throw new ConflictException(
          "Payroll period already exists for this branch and month",
        );
      }

      throw error;
    }
  }

  async listPeriods(
    user: PayrollAuthUser,
    companyId: string,
    branchId: string,
  ) {
    await this.branch(user, companyId, branchId);

    return this.prisma.payrollPeriod.findMany({
      where: {
        tenantId: user.tenantId,
        companyId,
        branchId,
      },
      include: {
        run: {
          select: {
            id: true,
            status: true,
            grossTotal: true,
            netTotal: true,
            policyModeSnapshot: true,
            policyVersionSnapshot: true,
          },
        },
      },
      orderBy: [{ year: "desc" }, { month: "desc" }],
    });
  }

  // =====================================================
  // PAYROLL POLICY RESOLUTION
  // =====================================================

  private async resolvePolicyForPeriod(
    tx: Prisma.TransactionClient,
    tenantId: string,
    companyId: string,
    startDate: Date,
    endDate: Date,
  ) {
    const policies = await tx.companyPayrollPolicy.findMany({
      where: {
        tenantId,
        companyId,
        effectiveFrom: {
          lte: endDate,
        },
        OR: [
          { effectiveTo: null },
          {
            effectiveTo: {
              gte: startDate,
            },
          },
        ],
      },
      orderBy: {
        version: "desc",
      },
    });

    if (policies.length > 1) {
      throw new ConflictException(
        "Multiple payroll policies overlap the selected month",
      );
    }

    const policy = policies[0];

    if (policy) {
      if (
        policy.effectiveFrom > startDate ||
        (policy.effectiveTo && policy.effectiveTo < endDate)
      ) {
        throw new ConflictException(
          "Partial-month payroll policies are not supported",
        );
      }
    }

    if (!policy) {
      return {
        policyId: null as string | null,
        version: 0,
        mode: PayrollCalculationMode.FIXED,
        dayBasis: PayrollDayBasis.CALENDAR_DAYS,
        missingAttendanceAction: MissingAttendanceAction.BLOCK_CALCULATION,
        halfDayDeduction: "0.50",
        deductUnpaidLeave: true,
        deductAbsentDays: true,
      };
    }

    return {
      policyId: policy.id,
      version: policy.version,
      mode: policy.mode,
      dayBasis: policy.dayBasis,
      missingAttendanceAction: policy.missingAttendanceAction,
      halfDayDeduction: policy.halfDayDeduction.toFixed(2),
      deductUnpaidLeave: policy.deductUnpaidLeave,
      deductAbsentDays: policy.deductAbsentDays,
    };
  }

  // =====================================================
  // CALCULATE MONTHLY PAYROLL
  // =====================================================

  async calculate(user: PayrollAuthUser, periodId: string) {
    this.admin(user);

    const period = await this.prisma.payrollPeriod.findFirst({
      where: {
        id: periodId,
        tenantId: user.tenantId,
      },
      select: {
        id: true,
        companyId: true,
        branchId: true,
      },
    });

    if (!period) {
      throw new NotFoundException("Payroll period not found");
    }

    await this.branch(user, period.companyId, period.branchId);

    try {
      return await this.prisma.$transaction(
        async (tx) => {
          // Read period and current run in the same
          // transaction used to calculate and write.
          const currentPeriod = await tx.payrollPeriod.findFirst({
            where: {
              id: periodId,
              tenantId: user.tenantId,
              companyId: period.companyId,
              branchId: period.branchId,
            },
            include: {
              run: true,
            },
          });

          if (!currentPeriod) {
            throw new NotFoundException("Payroll period no longer exists");
          }

          const currentRun = currentPeriod.run;

          if (currentRun && PROTECTED_STATUSES.includes(currentRun.status)) {
            throw new ConflictException(
              "Approved or paid payroll cannot be recalculated",
            );
          }

          // Even a draft or calculated run must not
          // be replaced when payments exist.
          if (currentRun) {
            const recordedPayments = await tx.payrollPayment.count({
              where: {
                entry: {
                  runId: currentRun.id,
                },
              },
            });

            if (recordedPayments > 0) {
              throw new ConflictException(
                "Payroll with recorded payments cannot be recalculated",
              );
            }
          }

          const policy = await this.resolvePolicyForPeriod(
            tx,
            user.tenantId,
            currentPeriod.companyId,
            currentPeriod.startDate,
            currentPeriod.endDate,
          );

          // Attendance-based calculation needs weekly
          // offs, holidays, approved leave and attendance
          // reconciliation. Never calculate fixed salary
          // while labeling the run ATTENDANCE_BASED.
          if (policy.mode === PayrollCalculationMode.ATTENDANCE_BASED) {
            throw new ConflictException(
              "Attendance-based payroll is not enabled yet. Attendance, leave, weekly-off and holiday reconciliation must be completed before calculation.",
            );
          }

          const assignments = await tx.employeeSalary.findMany({
            where: {
              tenantId: user.tenantId,
              companyId: currentPeriod.companyId,
              branchId: currentPeriod.branchId,

              effectiveFrom: {
                lte: currentPeriod.endDate,
              },

              OR: [
                { effectiveTo: null },
                {
                  effectiveTo: {
                    gte: currentPeriod.startDate,
                  },
                },
              ],

              user: {
                tenantId: user.tenantId,
                status: UserStatus.ACTIVE,
                companyAccess: {
                  some: {
                    companyId: currentPeriod.companyId,
                  },
                },
                branchAccess: {
                  some: {
                    branchId: currentPeriod.branchId,
                  },
                },
              },

              structure: {
                tenantId: user.tenantId,
                companyId: currentPeriod.companyId,
                status: RecordStatus.ACTIVE,
              },
            },

            include: {
              structure: {
                include: {
                  components: true,
                },
              },
            },

            orderBy: {
              effectiveFrom: "desc",
            },
          });

          if (!assignments.length) {
            throw new BadRequestException(
              "No active employee salaries found for this payroll period",
            );
          }

          const processedEmployees = new Set<string>();

          const entryData = assignments.map((salary) => {
            if (processedEmployees.has(salary.userId)) {
              throw new ConflictException(
                "Multiple salary assignments overlap the month. Split-period payroll is not supported.",
              );
            }

            processedEmployees.add(salary.userId);

            if (
              salary.effectiveFrom > currentPeriod.startDate ||
              (salary.effectiveTo && salary.effectiveTo < currentPeriod.endDate)
            ) {
              throw new BadRequestException(
                "Salary assignment must cover the full payroll month. Partial-month proration is not supported.",
              );
            }

            const basic = salary.basicOverride ?? salary.structure.basicAmount;

            const earnings = salary.structure.components
              .filter(
                (component) => component.kind === SalaryComponentKind.EARNING,
              )
              .reduce(
                (sum, component) => sum.add(component.amount),
                new Decimal(0),
              );

            const deductions = salary.structure.components
              .filter(
                (component) => component.kind === SalaryComponentKind.DEDUCTION,
              )
              .reduce(
                (sum, component) => sum.add(component.amount),
                new Decimal(0),
              );

            const gross = basic.add(earnings);
            const net = gross.sub(deductions);

            if (net.isNegative()) {
              throw new BadRequestException(
                `Salary deductions exceed gross salary for employee ${salary.userId}`,
              );
            }

            return {
              userId: salary.userId,
              employeeSalaryId: salary.id,
              currency: salary.structure.currency,
              basicAmount: basic,
              grossAmount: gross,
              deductionsAmount: deductions,
              netAmount: net,

              components: {
                create: [
                  {
                    code: "BASIC",
                    name: "Basic Salary",
                    kind: SalaryComponentKind.EARNING,
                    amount: basic,
                  },

                  ...salary.structure.components.map((component) => ({
                    code: component.code,
                    name: component.name,
                    kind: component.kind,
                    amount: component.amount,
                  })),
                ],
              },
            };
          });

          const grossTotal = entryData.reduce(
            (sum, entry) => sum.add(entry.grossAmount),
            new Decimal(0),
          );

          const deductionsTotal = entryData.reduce(
            (sum, entry) => sum.add(entry.deductionsAmount),
            new Decimal(0),
          );

          const netTotal = entryData.reduce(
            (sum, entry) => sum.add(entry.netAmount),
            new Decimal(0),
          );

          // Store the exact policy settings applied.
          // This is independent of later policy edits.
          const snapshotSettings: Prisma.InputJsonObject = {
            mode: policy.mode,
            dayBasis: policy.dayBasis,
            missingAttendanceAction: policy.missingAttendanceAction,
            halfDayDeduction: policy.halfDayDeduction,
            deductUnpaidLeave: policy.deductUnpaidLeave,
            deductAbsentDays: policy.deductAbsentDays,
            policyVersion: policy.version,
          };

          const calculatedAt = new Date();

          const runData = {
            status: PayrollStatus.CALCULATED,
            calculatedAt,
            grossTotal,
            deductionsTotal,
            netTotal,

            policyIdSnapshot: policy.policyId,

            policyVersionSnapshot: policy.version,

            policyModeSnapshot: policy.mode,

            policySettingsSnapshot: snapshotSettings,

            policySnapshotAt: calculatedAt,
          };

          // Replace only non-finalized calculations.
          // Snapshot rows from approved/paid runs are
          // never deleted by this method.
          if (currentRun) {
            await tx.payrollEntryComponent.deleteMany({
              where: {
                entry: {
                  runId: currentRun.id,
                },
              },
            });

            await tx.payrollEntry.deleteMany({
              where: {
                runId: currentRun.id,
              },
            });
          }

          const run = currentRun
            ? await tx.payrollRun.update({
                where: {
                  id: currentRun.id,
                },
                data: {
                  ...runData,
                  createdById: user.id,
                  approvedById: null,
                  approvedAt: null,
                },
              })
            : await tx.payrollRun.create({
                data: {
                  tenantId: user.tenantId,
                  companyId: currentPeriod.companyId,
                  branchId: currentPeriod.branchId,
                  periodId,
                  createdById: user.id,
                  ...runData,
                },
              });

          for (const entry of entryData) {
            await tx.payrollEntry.create({
              data: {
                runId: run.id,
                ...entry,
              },
            });
          }

          return tx.payrollRun.findUniqueOrThrow({
            where: {
              id: run.id,
            },
            include: {
              period: true,
              entries: {
                include: {
                  components: true,
                },
              },
            },
          });
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        },
      );
    } catch (error) {
      if (this.isUniqueError(error) || this.isTransactionConflict(error)) {
        throw new ConflictException(
          "Concurrent payroll calculation. Reload and retry.",
        );
      }

      throw error;
    }
  }

  // =====================================================
  // APPROVE PAYROLL
  // =====================================================

  async approve(user: PayrollAuthUser, runId: string) {
    this.admin(user);

    const run = await this.prisma.payrollRun.findFirst({
      where: {
        id: runId,
        tenantId: user.tenantId,
      },
      select: {
        id: true,
        companyId: true,
        branchId: true,
        status: true,
        createdById: true,
      },
    });

    if (!run) {
      throw new NotFoundException("Payroll run not found");
    }

    await this.branch(user, run.companyId, run.branchId);

    // Enforce maker-checker separation on the server, not only in the UI.
    if (run.createdById === user.id) {
      throw new ForbiddenException(
        "A payroll preparer cannot approve their own run. Sign in as a different authorized payroll administrator.",
      );
    }

    if (run.status !== PayrollStatus.CALCULATED) {
      throw new ConflictException("Only calculated payroll can be approved");
    }

    await this.prisma.$transaction(async (tx) => {
      const result = await tx.payrollRun.updateMany({
        where: {
          id: run.id,
          tenantId: user.tenantId,
          status: PayrollStatus.CALCULATED,
          createdById: { not: user.id },
        },
        data: {
          status: PayrollStatus.APPROVED,
          approvedById: user.id,
          approvedAt: new Date(),
        },
      });
      if (result.count !== 1)
        throw new ConflictException(
          "Payroll status changed. Reload and retry.",
        );
      await this.audit.record(tx, {
        actor: user,
        companyId: run.companyId,
        branchId: run.branchId,
        module: "PAYROLL",
        action: "PAYROLL_APPROVED",
        targetId: run.id,
        detail: "Payroll run independently approved",
      });
    });

    return this.getRun(user, run.id);
  }

  // =====================================================
  // PUBLISH PAYSLIPS (independent of payment settlement)
  // =====================================================

  async publish(user: PayrollAuthUser, runId: string) {
    this.admin(user);
    const run = await this.prisma.payrollRun.findFirst({
      where: { id: runId, tenantId: user.tenantId },
      select: {
        id: true,
        companyId: true,
        branchId: true,
        status: true,
        publishedAt: true,
      },
    });
    if (!run) throw new NotFoundException("Payroll run not found");
    await this.branch(user, run.companyId, run.branchId);
    if (
      run.status !== PayrollStatus.APPROVED &&
      run.status !== PayrollStatus.PAID
    ) {
      throw new ConflictException("Approve payroll before publishing payslips");
    }
    // Repeat requests return the same immutable publication, never create duplicates.
    if (run.publishedAt) return this.getRun(user, run.id);
    const result = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.payrollRun.updateMany({
        where: {
          id: run.id,
          tenantId: user.tenantId,
          publishedAt: null,
          status: { in: [PayrollStatus.APPROVED, PayrollStatus.PAID] },
        },
        data: { publishedAt: new Date(), publishedById: user.id },
      });
      if (updated.count === 1) {
        await this.audit.record(tx, {
          actor: user,
          companyId: run.companyId,
          branchId: run.branchId,
          module: "PAYROLL",
          action: "PAYSLIPS_PUBLISHED",
          targetId: run.id,
          detail: "Employee payslips published",
        });
      }
      return updated;
    });
    if (result.count !== 1) {
      const current = await this.prisma.payrollRun.findFirst({
        where: { id: run.id, tenantId: user.tenantId },
        select: { publishedAt: true },
      });
      if (!current?.publishedAt)
        throw new ConflictException(
          "Publication state changed. Reload and retry.",
        );
    }
    return this.getRun(user, run.id);
  }

  // =====================================================
  // PAYROLL RUN DETAILS
  // =====================================================

  async getRun(user: PayrollAuthUser, runId: string) {
    this.admin(user);

    const run = await this.prisma.payrollRun.findFirst({
      where: {
        id: runId,
        tenantId: user.tenantId,
      },
      include: {
        period: true,
        entries: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
            components: true,
            payment: true,
          },
        },
      },
    });

    if (!run) {
      throw new NotFoundException("Payroll run not found");
    }

    await this.branch(user, run.companyId, run.branchId);

    return run;
  }

  // =====================================================
  // RECORD PAYROLL PAYMENT
  // =====================================================

  async recordPayment(
    user: PayrollAuthUser,
    entryId: string,
    dto: RecordPayrollPaymentDto,
  ) {
    this.admin(user);

    if (!Object.values(PayrollPaymentMethod).includes(dto.method)) {
      throw new BadRequestException("Invalid payment method");
    }

    const entry = await this.prisma.payrollEntry.findFirst({
      where: {
        id: entryId,
        run: {
          tenantId: user.tenantId,
        },
      },
      include: {
        run: true,
        payment: true,
      },
    });

    if (!entry) {
      throw new NotFoundException("Payroll entry not found");
    }

    await this.branch(user, entry.run.companyId, entry.run.branchId);

    if (entry.run.status !== PayrollStatus.APPROVED) {
      throw new ConflictException("Payroll must be approved before payment");
    }

    if (entry.payment) {
      throw new ConflictException("Payslip already marked as paid");
    }

    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const current = await tx.payrollRun.findUniqueOrThrow({
            where: {
              id: entry.runId,
            },
          });

          if (current.status !== PayrollStatus.APPROVED) {
            throw new ConflictException("Payroll is not awaiting payment");
          }

          const currentEntry = await tx.payrollEntry.findUniqueOrThrow({
            where: {
              id: entryId,
            },
            include: {
              payment: true,
            },
          });

          if (currentEntry.runId !== current.id) {
            throw new ConflictException(
              "Payroll entry does not belong to this run",
            );
          }

          if (currentEntry.payment) {
            throw new ConflictException("Payslip payment already recorded");
          }

          const payment = await tx.payrollPayment.create({
            data: {
              entryId,
              amount: currentEntry.netAmount,
              method: dto.method,
              reference: dto.reference?.trim() || null,
              recordedById: user.id,
            },
          });

          const total = await tx.payrollEntry.count({
            where: {
              runId: current.id,
            },
          });

          const paid = await tx.payrollPayment.count({
            where: {
              entry: {
                runId: current.id,
              },
            },
          });

          if (total > 0 && total === paid) {
            const updated = await tx.payrollRun.updateMany({
              where: {
                id: current.id,
                status: PayrollStatus.APPROVED,
              },
              data: {
                status: PayrollStatus.PAID,
                paidAt: new Date(),
              },
            });

            if (updated.count !== 1) {
              throw new ConflictException(
                "Payroll status changed during payment",
              );
            }
          }

          await this.audit.record(tx, {
            actor: user,
            companyId: entry.run.companyId,
            branchId: entry.run.branchId,
            module: "PAYROLL",
            action: "PAYMENT_RECORDED",
            targetId: entryId,
            detail: `Manual payment record via ${dto.method}; settlement not independently verified`,
          });
          return payment;
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        },
      );
    } catch (error) {
      if (this.isUniqueError(error)) {
        throw new ConflictException("Payslip payment already recorded");
      }

      if (this.isTransactionConflict(error)) {
        throw new ConflictException(
          "Concurrent payroll payment. Reload and retry.",
        );
      }

      throw error;
    }
  }

  // =====================================================
  // EMPLOYEE PAYSLIPS
  // =====================================================

  async myPayslips(user: PayrollAuthUser) {
    if (!user?.id || !user?.tenantId) {
      throw new ForbiddenException("Tenant login required");
    }

    return this.prisma.payrollEntry.findMany({
      where: {
        userId: user.id,
        run: {
          tenantId: user.tenantId,
          status: {
            in: [PayrollStatus.APPROVED, PayrollStatus.PAID],
          },
          publishedAt: { not: null },
        },
      },
      include: {
        components: true,
        payment: true,
        run: {
          select: {
            id: true,
            status: true,
            publishedAt: true,
            policyModeSnapshot: true,
            policyVersionSnapshot: true,
            period: {
              select: {
                year: true,
                month: true,
                startDate: true,
                endDate: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 60,
    });
  }
}
