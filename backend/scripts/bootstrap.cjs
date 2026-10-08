require("dotenv").config();

const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcrypt");
const { randomBytes } = require("crypto");

const prisma = new PrismaClient();

async function main() {
  // Prevent accidental reinitialization.
  const existingTenants = await prisma.tenant.count();
  const existingUsers = await prisma.user.count();

  if (existingTenants > 0 || existingUsers > 0) {
    throw new Error("Bootstrap stopped: tenant or user data already exists.");
  }

  const name = process.env.BOOTSTRAP_ADMIN_NAME?.trim();
  const email = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;

  if (!name || !email || !password || password.length < 6) {
    throw new Error(
      "Set BOOTSTRAP_ADMIN_NAME, BOOTSTRAP_ADMIN_EMAIL " +
        "and BOOTSTRAP_ADMIN_PASSWORD (minimum 6 characters).",
    );
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const permissionKeys = [
    "dashboard:read",
    ...["leads", "contacts", "customers", "deals", "quotes"].flatMap((kind) =>
      ["read", "create", "update", "delete"].map(
        (action) => `${kind}:${action}`,
      ),
    ),
  ];

  const result = await prisma.$transaction(async (tx) => {
    // Initial business
    const tenant = await tx.tenant.create({
      data: {
        name: "5 Gen Educon",
        status: "ACTIVE",
      },
    });

    // First company
    const company = await tx.company.create({
      data: {
        tenantId: tenant.id,
        name: "5 Gen Educon",
        status: "ACTIVE",
      },
    });

    // First branch
    const branch = await tx.branch.create({
      data: {
        companyId: company.id,
        name: "Vijayawada",
        status: "ACTIVE",
      },
    });

    const role = await tx.role.upsert({
      where: { name: "BUSINESS_ADMIN" },
      update: {},
      create: {
        name: "BUSINESS_ADMIN",
        description: "Business administrator",
      },
    });

    for (const key of permissionKeys) {
      const permission = await tx.permission.upsert({
        where: { key },
        update: {},
        create: {
          key,
          name: key,
        },
      });

      await tx.rolePermission.create({
        data: {
          roleId: role.id,
          permissionId: permission.id,
        },
      });
    }

    const user = await tx.user.create({
      data: {
        tenantId: tenant.id,
        name,
        email,
        password: passwordHash,
        status: "ACTIVE",
      },
    });

    await tx.userRole.create({
      data: {
        userId: user.id,
        roleId: role.id,
      },
    });

    await tx.userCompanyAccess.create({
      data: {
        userId: user.id,
        companyId: company.id,
      },
    });

    await tx.userBranchAccess.create({
      data: {
        userId: user.id,
        branchId: branch.id,
      },
    });

    return { tenant, company, branch, user, role };
  });

  console.log("Bootstrap completed successfully");
  console.log("Tenant ID:", result.tenant.id);
  console.log("Company ID:", result.company.id);
  console.log("Branch ID:", result.branch.id);
  console.log("Admin ID:", result.user.id);
  console.log("Admin email:", result.user.email);
  console.log("Role:", result.role.name);
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
