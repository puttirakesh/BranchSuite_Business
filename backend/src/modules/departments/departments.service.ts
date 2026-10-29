import { assertCompanyScope } from '../../common/company-scope';
import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService, type AuditActor } from '../audit/audit.service';
import { CreateDepartmentDto, DepartmentEmployeesDto, ListDepartmentsDto } from './department.dto';

const departmentInclude = { branch: { select: { id: true, name: true } } } as const;
const normalize = (name: string) => name.trim().replace(/\s+/g, ' ').toLowerCase();

@Injectable()
export class DepartmentsService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  private async authorize(actor: AuditActor, companyId: string, branchId?: string, hrReader = false) {
    if (!actor?.id || !actor.tenantId || !actor.roles?.some(role => ['BUSINESS_OWNER', 'BUSINESS_ADMIN', ...(hrReader ? ['HR_MANAGER'] : [])].includes(role))) {
      throw new ForbiddenException('Business administrator access required');
    }
    assertCompanyScope(actor, companyId);
    const owner = actor.roles.includes('BUSINESS_OWNER');
    const company = await this.prisma.company.findFirst({ where: {
      id: companyId, tenantId: actor.tenantId, status: 'ACTIVE',
      ...(!owner ? { userAccess: { some: { userId: actor.id } } } : {}),
    }, select: { id: true } });
    if (!company) throw new NotFoundException('Active company not found or access denied');
    if (branchId) {
      const branch = await this.prisma.branch.findFirst({ where: {
        id: branchId, companyId, status: 'ACTIVE',
        ...(!owner ? { userAccess: { some: { userId: actor.id } } } : {}),
      }, select: { id: true } });
      if (!branch) throw new NotFoundException('Active branch not found or access denied');
    }
    return owner;
  }

  async list(actor: AuditActor, query: ListDepartmentsDto) {
    const owner = await this.authorize(actor, query.companyId, query.branchId, true);
    const [departments, employees] = await Promise.all([this.prisma.department.findMany({ where: {
      tenantId: actor.tenantId, companyId: query.companyId,
      OR: [
        { branchId: null },
        { branch: { status: 'ACTIVE', ...(query.branchId ? { id: query.branchId } : {}),
          ...(!owner ? { userAccess: { some: { userId: actor.id } } } : {}) } },
      ],
    }, include: departmentInclude, orderBy: [{ name: 'asc' }, { id: 'asc' }] }),
      this.prisma.employeeProfile.findMany({ where: this.employeeScope(actor, query.companyId, owner, query.branchId),
        select: { userId: true, branchId: true, department: true } }),
    ]);
    // Count people once even if they have assignments in several branches.
    const groups = new Map<string, Set<string>>();
    for (const employee of employees) {
      if (!employee.department) continue;
      const name = normalize(employee.department);
      for (const key of [`all:${name}`, `${employee.branchId}:${name}`]) {
        if (!groups.has(key)) groups.set(key, new Set());
        groups.get(key)!.add(employee.userId);
      }
    }
    return departments.map(department => ({ ...department,
      employeeCount: groups.get(`${department.branchId ?? 'all'}:${department.normalizedName}`)?.size ?? 0,
      totalEmployeeCount: groups.get(`all:${department.normalizedName}`)?.size ?? 0,
    }));
  }

  private employeeScope(actor: AuditActor, companyId: string, owner: boolean, branchId?: string): Prisma.EmployeeProfileWhereInput {
    return {
      tenantId: actor.tenantId, companyId, ...(branchId ? { branchId } : {}), department: { not: null },
      branch: { status: 'ACTIVE', ...(!owner ? { userAccess: { some: { userId: actor.id } } } : {}) },
    };
  }

  async employees(actor: AuditActor, id: string, query: DepartmentEmployeesDto) {
    const department = await this.prisma.department.findFirst({ where: { id, tenantId: actor.tenantId } });
    if (!department) throw new NotFoundException('Department not found');
    const owner = await this.authorize(actor, department.companyId, department.branchId ?? query.branchId);
    if (query.branchId) {
      await this.authorize(actor, department.companyId, query.branchId);
      if (department.branchId && department.branchId !== query.branchId) throw new NotFoundException('Department is not available in this branch');
    }
    const profiles = await this.prisma.employeeProfile.findMany({
      where: this.employeeScope(actor, department.companyId, owner, query.branchId),
      select: { userId: true, employeeCode: true, department: true, designation: true, status: true, workEmail: true,
        user: { select: { name: true, email: true } }, branch: { select: { id: true, name: true } } },
      orderBy: [{ user: { name: 'asc' } }, { id: 'asc' }],
    });
    const people = new Map<string, { id: string; name: string; email: string; employeeCode: string; designation: string | null; status: string; branches: { id: string; name: string }[] }>();
    for (const profile of profiles) {
      if (!profile.department || normalize(profile.department) !== department.normalizedName) continue;
      const existing = people.get(profile.userId);
      if (existing) {
        if (!existing.branches.some(branch => branch.id === profile.branch.id)) existing.branches.push(profile.branch);
      } else people.set(profile.userId, { id: profile.userId, name: profile.user.name, email: profile.workEmail ?? profile.user.email,
        employeeCode: profile.employeeCode, designation: profile.designation, status: profile.status, branches: [profile.branch] });
    }
    return [...people.values()];
  }

  async create(actor: AuditActor, dto: CreateDepartmentDto) {
    await this.authorize(actor, dto.companyId, dto.branchId);
    const name = typeof dto.name === 'string' ? dto.name.trim().replace(/\s+/g, ' ') : '';
    if (!name || name.length > 100) throw new BadRequestException('Department name must contain 1 to 100 characters');
    try {
      return await this.prisma.$transaction(async tx => {
        const department = await tx.department.create({ data: {
          tenantId: actor.tenantId, companyId: dto.companyId, branchId: dto.branchId ?? null,
          name, normalizedName: name.toLowerCase(),
        }, include: departmentInclude });
        await this.audit.record(tx, { actor, companyId: dto.companyId, branchId: dto.branchId,
          module: 'DEPARTMENTS', action: 'DEPARTMENT_CREATED', targetId: department.id, detail: `Created department ${name}` });
        const employees = await tx.employeeProfile.findMany({ where: this.employeeScope(actor, dto.companyId, actor.roles.includes('BUSINESS_OWNER'), dto.branchId), select: { userId: true, department: true } });
        const employeeCount = new Set(employees.filter(employee => employee.department && normalize(employee.department) === department.normalizedName).map(employee => employee.userId)).size;
        return { ...department, employeeCount, totalEmployeeCount: employeeCount };
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('This department already exists in the selected company or branch');
      }
      throw error;
    }
  }
}
