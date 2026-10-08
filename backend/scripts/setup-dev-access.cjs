
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const TENANT_ID = '1652cac5-3d63-4696-81b2-e7fcd952e8d8';

async function main() {
  const tenant = await prisma.tenant.findUnique({
    where: { id: TENANT_ID },
  });

  if (!tenant || tenant.status !== 'ACTIVE') {
    throw new Error('Active tenant not found');
  }

  // Reuse an existing company if it is already saved.
  let company = await prisma.company.findFirst({
    where: {
      tenantId: tenant.id,
      name: '5 Gen Educon',
    },
  });

  if (!company) {
    company = await prisma.company.create({
      data: {
        tenantId: tenant.id,
        name: '5 Gen Educon',
        status: 'ACTIVE',
      },
    });
  }

  // Create one working branch.
  let branch = await prisma.branch.findFirst({
    where: {
      companyId: company.id,
      name: 'Main Branch',
    },
  });

  if (!branch) {
    branch = await prisma.branch.create({
      data: {
        companyId: company.id,
        name: 'Main Branch',
        status: 'ACTIVE',
      },
    });
  }

  // Create administrator role.
  const role = await prisma.role.upsert({
    where: { name: 'BUSINESS_ADMIN' },
    update: {},
    create: {
      name: 'BUSINESS_ADMIN',
      description: 'Business administrator',
    },
  });

  // Initial permissions.
  const permissionKeys = [
    'dashboard:read',
    'leads:read',
    'leads:create',
    'leads:update',
    'leads:delete',
    'contacts:read',
    'contacts:create',
    'contacts:update',
    'contacts:delete',
    'customers:read',
    'customers:create',
    'customers:update',
    'customers:delete',
    'deals:read',
    'deals:create',
    'deals:update',
    'deals:delete',
    'quotes:read',
    'quotes:create',
    'quotes:update',
    'quotes:delete',
  ];

  for (const key of permissionKeys) {
    const permission = await prisma.permission.upsert({
      where: { key },
      update: {},
      create: {
        key,
        name: key,
      },
    });

    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: role.id,
          permissionId: permission.id,
        },
      },
      update: {},
      create: {
        roleId: role.id,
        permissionId: permission.id,
      },
    });
  }

  // Reuse the existing active user.
  const user = await prisma.user.findFirst({
    where: {
      tenantId: tenant.id,
      status: 'ACTIVE',
    },
    orderBy: {
      createdAt: 'asc',
    },
  });

  if (!user) {
    throw new Error(
      'No active user found for this tenant. Create a user first.'
    );
  }

  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: user.id,
        roleId: role.id,
      },
    },
    update: {},
    create: {
      userId: user.id,
      roleId: role.id,
    },
  });

  await prisma.userCompanyAccess.upsert({
    where: {
      userId_companyId: {
        userId: user.id,
        companyId: company.id,
      },
    },
    update: {},
    create: {
      userId: user.id,
      companyId: company.id,
    },
  });

  await prisma.userBranchAccess.upsert({
    where: {
      userId_branchId: {
        userId: user.id,
        branchId: branch.id,
      },
    },
    update: {},
    create: {
      userId: user.id,
      branchId: branch.id,
    },
  });

  console.log('Initial setup completed');
  console.log('Tenant:', tenant.name);
  console.log('Company:', company.name);
  console.log('Branch:', branch.name);
  console.log('User:', user.email);
  console.log('Role:', role.name);
  console.log('Permissions:', permissionKeys.length);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
