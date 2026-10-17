import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import { Prisma, RecordStatus, TaskStatus, UserStatus } from "@prisma/client";

import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";

import {
  CreateTaskCommentDto,
  CreateTaskDto,
  TaskListQueryDto,
  UpdateTaskDto,
  UpdateTaskStatusDto,
} from "./dto/task.dto";

export interface TaskAuthUser {
  id: string;
  tenantId: string;
  roles: string[];
}

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private isAdmin(user: TaskAuthUser): boolean {
    return Boolean(
      user?.roles?.some((role) =>
        ["BUSINESS_OWNER", "BUSINESS_ADMIN"].includes(role),
      ),
    );
  }

  private requireUser(user: TaskAuthUser): void {
    if (!user?.id || !user?.tenantId) {
      throw new ForbiddenException("Tenant login required");
    }
  }

  private requireAdmin(user: TaskAuthUser): void {
    this.requireUser(user);
    if (!this.isAdmin(user)) {
      throw new ForbiddenException("Administrator access required");
    }
  }

  private async checkScope(
    user: TaskAuthUser,
    companyId: string,
    branchId: string,
  ): Promise<void> {
    this.requireAdmin(user);

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
      select: { id: true },
    });

    if (!branch) {
      throw new NotFoundException("Active company or branch not found");
    }

    if (user.roles.includes("BUSINESS_OWNER")) {
      return;
    }

    const [companyAccess, branchAccess] = await Promise.all([
      this.prisma.userCompanyAccess.findUnique({
        where: {
          userId_companyId: {
            userId: user.id,
            companyId,
          },
        },
      }),
      this.prisma.userBranchAccess.findUnique({
        where: {
          userId_branchId: {
            userId: user.id,
            branchId,
          },
        },
      }),
    ]);

    if (!companyAccess || !branchAccess) {
      throw new ForbiddenException("Company or branch access denied");
    }
  }

  private async checkAssignee(
    user: TaskAuthUser,
    companyId: string,
    branchId: string,
    assignedToId: string,
  ): Promise<void> {
    const employee = await this.prisma.user.findFirst({
      where: {
        id: assignedToId,
        tenantId: user.tenantId,
        status: UserStatus.ACTIVE,
        companyAccess: {
          some: { companyId },
        },
        branchAccess: {
          some: { branchId },
        },
      },
      select: { id: true },
    });

    if (!employee) {
      throw new BadRequestException(
        "Assignee must be an active user assigned to this company and branch",
      );
    }
  }

  private taskInclude = {
    assignedTo: {
      select: { id: true, name: true, email: true },
    },
    createdBy: {
      select: { id: true, name: true },
    },
    _count: {
      select: { comments: true },
    },
  } as const;

  async create(user: TaskAuthUser, dto: CreateTaskDto) {
    await this.checkScope(user, dto.companyId, dto.branchId);

    await this.checkAssignee(
      user,
      dto.companyId,
      dto.branchId,
      dto.assignedToId,
    );

    const title = dto.title?.trim();

    if (!title) {
      throw new BadRequestException("Task title is required");
    }

    return this.prisma.$transaction(async (tx) => {
      const task = await tx.task.create({
        data: {
          tenantId: user.tenantId,
          companyId: dto.companyId,
          branchId: dto.branchId,
          title,
          description: dto.description?.trim() || null,
          assignedToId: dto.assignedToId,
          createdById: user.id,
          priority: dto.priority ?? "MEDIUM",
          dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
        },
        include: this.taskInclude,
      });
      await this.audit.record(tx, {
        actor: user,
        companyId: task.companyId,
        branchId: task.branchId,
        module: "TASKS",
        action: "TASK_CREATED",
        targetId: task.id,
        detail: "Task created and assigned",
        changes: { assignedToId: task.assignedToId, priority: task.priority },
      });
      return task;
    });
  }

  async list(user: TaskAuthUser, query: TaskListQueryDto) {
    this.requireUser(user);

    const where: Prisma.TaskWhereInput = {
      tenantId: user.tenantId,
      ...(query.companyId && {
        companyId: query.companyId,
      }),
      ...(query.branchId && {
        branchId: query.branchId,
      }),
      ...(query.status && {
        status: query.status,
      }),
      ...(query.priority && {
        priority: query.priority,
      }),
    };

    if (this.isAdmin(user)) {
      if (user.roles.includes("BUSINESS_OWNER")) {
        // Owner can see tasks belonging to their tenant.
        if (query.assignedToId) {
          where.assignedToId = query.assignedToId;
        }
      } else {
        // Admin is restricted to assigned company/branch scopes.
        where.company = {
          tenantId: user.tenantId,
          userAccess: {
            some: { userId: user.id },
          },
        };
        where.branch = {
          userAccess: {
            some: { userId: user.id },
          },
        };
        if (query.assignedToId) {
          where.assignedToId = query.assignedToId;
        }
      }
    } else {
      // Employees always see their own assigned tasks.
      where.assignedToId = user.id;
    }

    return this.prisma.task.findMany({
      where,
      include: this.taskInclude,
      orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
      take: 200,
    });
  }

  async myTasks(user: TaskAuthUser) {
    this.requireUser(user);

    return this.prisma.task.findMany({
      where: {
        tenantId: user.tenantId,
        assignedToId: user.id,
      },
      include: this.taskInclude,
      orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
      take: 200,
    });
  }

  private async accessibleTask(user: TaskAuthUser, id: string) {
    this.requireUser(user);

    const task = await this.prisma.task.findFirst({
      where: {
        id,
        tenantId: user.tenantId,
      },
    });

    if (!task) {
      throw new NotFoundException("Task not found");
    }

    if (this.isAdmin(user)) {
      await this.checkScope(user, task.companyId, task.branchId);
    } else if (task.assignedToId !== user.id) {
      throw new ForbiddenException("Task access denied");
    }

    return task;
  }

  async getOne(user: TaskAuthUser, id: string) {
    await this.accessibleTask(user, id);

    return this.prisma.task.findUniqueOrThrow({
      where: { id },
      include: {
        ...this.taskInclude,
        comments: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
              },
            },
          },
          orderBy: { createdAt: "asc" },
          take: 200,
        },
      },
    });
  }

  async update(user: TaskAuthUser, id: string, dto: UpdateTaskDto) {
    this.requireAdmin(user);
    const task = await this.accessibleTask(user, id);

    if (dto.assignedToId) {
      await this.checkAssignee(
        user,
        task.companyId,
        task.branchId,
        dto.assignedToId,
      );
    }

    if (dto.title !== undefined && !dto.title.trim()) {
      throw new BadRequestException("Task title cannot be empty");
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.task.update({
        where: { id },
        data: {
          ...(dto.title !== undefined && { title: dto.title.trim() }),
          ...(dto.description !== undefined && {
            description: dto.description.trim() || null,
          }),
          ...(dto.priority !== undefined && { priority: dto.priority }),
          ...(dto.assignedToId !== undefined && {
            assignedToId: dto.assignedToId,
          }),
          ...(dto.dueDate !== undefined && { dueDate: new Date(dto.dueDate) }),
        },
        include: this.taskInclude,
      });
      const changedFields = [
        ...(dto.title !== undefined && dto.title.trim() !== task.title
          ? ["title"]
          : []),
        ...(dto.description !== undefined &&
        (dto.description.trim() || null) !== task.description
          ? ["description"]
          : []),
        ...(dto.priority !== undefined && dto.priority !== task.priority
          ? ["priority"]
          : []),
        ...(dto.dueDate !== undefined &&
        new Date(dto.dueDate).getTime() !== task.dueDate?.getTime()
          ? ["dueDate"]
          : []),
      ];
      if (changedFields.length > 0) {
        await this.audit.record(tx, {
          actor: user,
          companyId: task.companyId,
          branchId: task.branchId,
          module: "TASKS",
          action: "TASK_UPDATED",
          targetId: task.id,
          detail: "Task fields updated",
          changes: { fields: changedFields },
        });
      }
      if (task.assignedToId !== updated.assignedToId) {
        await this.audit.record(tx, {
          actor: user,
          companyId: task.companyId,
          branchId: task.branchId,
          module: "TASKS",
          action: "TASK_REASSIGNED",
          targetId: task.id,
          detail: "Task reassigned",
          changes: {
            fromUserId: task.assignedToId,
            toUserId: updated.assignedToId,
          },
        });
      }
      return updated;
    });
  }

  async updateStatus(user: TaskAuthUser, id: string, dto: UpdateTaskStatusDto) {
    const task = await this.accessibleTask(user, id);

    if (!this.isAdmin(user) && dto.status === TaskStatus.CANCELLED) {
      throw new ForbiddenException("Only an administrator can cancel tasks");
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.task.update({
        where: { id: task.id },
        data: {
          status: dto.status,
          completedAt:
            dto.status === TaskStatus.COMPLETED
              ? (task.completedAt ?? new Date())
              : null,
        },
        include: this.taskInclude,
      });
      if (task.status !== updated.status) {
        await this.audit.record(tx, {
          actor: user,
          companyId: task.companyId,
          branchId: task.branchId,
          module: "TASKS",
          action:
            updated.status === TaskStatus.COMPLETED
              ? "TASK_COMPLETED"
              : updated.status === TaskStatus.CANCELLED
                ? "TASK_CANCELLED"
                : "TASK_STATUS_CHANGED",
          targetId: task.id,
          detail: "Task status changed",
          changes: { from: task.status, to: updated.status },
        });
      }
      return updated;
    });
  }

  async addComment(user: TaskAuthUser, id: string, dto: CreateTaskCommentDto) {
    const task = await this.accessibleTask(user, id);
    const message = dto.message?.trim();

    if (!message) {
      throw new BadRequestException("Comment cannot be empty");
    }

    return this.prisma.$transaction(async (tx) => {
      const comment = await tx.taskComment.create({
        data: {
          taskId: task.id,
          tenantId: user.tenantId,
          companyId: task.companyId,
          branchId: task.branchId,
          userId: user.id,
          message,
        },
        include: { user: { select: { id: true, name: true } } },
      });
      await this.audit.record(tx, {
        actor: user,
        companyId: task.companyId,
        branchId: task.branchId,
        module: "TASKS",
        action: "TASK_COMMENT_ADDED",
        targetId: task.id,
        detail: "Task comment added",
        changes: { commentId: comment.id },
      });
      return comment;
    });
  }
}
