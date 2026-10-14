
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const permissions = [
  { key: 'companies.read', name: 'View companies' },
  { key: 'companies.manage', name: 'Manage companies' },
  { key: 'branches.read', name: 'View branches' },
  { key: 'branches.manage', name: 'Manage branches' },
  { key: 'users.read', name: 'View users' },
  { key: 'users.manage', name: 'Manage users' },
  { key: 'crm.read', name: 'View CRM records' },
  { key: 'crm.manage', name: 'Manage CRM records' },
  { key: 'attendance.read', name: 'View attendance' },
  { key: 'attendance.manage', name: 'Manage attendance' },
  { key: 'payroll.read', name: 'View payroll' },
  { key: 'payroll.manage', name: 'Manage payroll' },
] as const;

const roles = [
  {
    name: 'BUSINESS_OWNER',
    description: 'Business owner with full permissions',
    permissions: permissions.map((p) => p.key),
  },
  {
    name: 'BUSINESS_ADMIN',
    description: 'Business administrator',
    permissions: permissions.map((p) => p.key),
  },
  {
    name: 'HR_MANAGER',
    description: 'Human resources manager',
    permissions: [
      'users.read',
      'attendance.read',
      'attendance.manage',
    ],
  },
  {
    name: 'PAYROLL_MANAGER',
    description: 'Payroll manager',
    permissions: [
      'users.read',
      'attendance.read',
      'payroll.read',
      'payroll.manage',
    ],
  },
  {
    name: 'BRANCH_MANAGER',
    description: 'Branch operations manager',
    permissions: [
      'branches.read',
      'users.read',
      'crm.read',
      'crm.manage',
      'attendance.read',
    ],
  },
  {
    name: 'EMPLOYEE',
    description: 'Standard employee',
    permissions: [],
  },
] as const;

async function main() {
  console.log('Starting RBAC seed...');

  const permissionIds = new Map<string, string>();

  for (const permission of permissions) {
    const saved = await prisma.permission.upsert({
      where: { key: permission.key },
      update: {
        name: permission.name,
      },
      create: {
        key: permission.key,
        name: permission.name,
      },
    });

    permissionIds.set(saved.key, saved.id);
  }

  for (const roleDefinition of roles) {
    const role = await prisma.role.upsert({
      where: { name: roleDefinition.name },
      update: {
        description: roleDefinition.description,
      },
      create: {
        name: roleDefinition.name,
        description: roleDefinition.description,
      },
    });

    for (const permissionKey of roleDefinition.permissions) {
      const permissionId = permissionIds.get(permissionKey);

      if (!permissionId) {
        throw new Error(
          `Missing permission: ${permissionKey}`,
        );
      }

      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: role.id,
            permissionId,
          },
        },
        update: {},
        create: {
          roleId: role.id,
          permissionId,
        },
      });
    }

    console.log(`Configured role: ${role.name}`);
  }

  console.log('RBAC seed completed successfully.');
}

main()
  .catch((error) => {
    console.error('RBAC seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
