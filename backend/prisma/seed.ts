import "dotenv/config";
import { PlatformRole, PrismaClient } from "@prisma/client";
import * as bcrypt from "bcrypt";

const prisma = new PrismaClient();

const permissions = [
  { key: "companies.read", name: "View companies" },
  { key: "companies.manage", name: "Manage companies" },
  { key: "branches.read", name: "View branches" },
  { key: "branches.manage", name: "Manage branches" },
  { key: "users.read", name: "View users" },
  { key: "users.manage", name: "Manage users" },
  { key: "crm.read", name: "View CRM records" },
  { key: "crm.manage", name: "Manage CRM records" },
  { key: "attendance.read", name: "View attendance" },
  { key: "attendance.manage", name: "Manage attendance" },
  { key: "payroll.read", name: "View payroll" },
  { key: "payroll.manage", name: "Manage payroll" },
] as const;

const roles = [
  {
    name: "BUSINESS_OWNER",
    description: "Business owner with full permissions",
    permissions: permissions.map((p) => p.key),
  },
  {
    name: "BUSINESS_ADMIN",
    description: "Business administrator",
    permissions: permissions.map((p) => p.key),
  },
  {
    name: "HR_MANAGER",
    description: "Human resources manager",
    permissions: ["users.read", "attendance.read", "attendance.manage"],
  },
  {
    name: "PAYROLL_MANAGER",
    description: "Payroll manager",
    permissions: [
      "users.read",
      "attendance.read",
      "payroll.read",
      "payroll.manage",
    ],
  },
  {
    name: "COMPANY_MANAGER",
    description:
      "Company operations and payroll approval within assigned branches",
    permissions: [
      "branches.read",
      "users.read",
      "crm.read",
      "crm.manage",
      "attendance.read",
      "payroll.read",
    ],
  },
  {
    name: "BRANCH_MANAGER",
    description: "Branch operations manager",
    permissions: [
      "branches.read",
      "users.read",
      "crm.read",
      "crm.manage",
      "attendance.read",
      "payroll.read",
    ],
  },
  {
    name: "SALES_MANAGER",
    description: "Sales workspace access for assigned branches",
    permissions: ["crm.read", "crm.manage"],
  },
  {
    name: "EMPLOYEE",
    description: "Standard employee",
    permissions: [],
  },
] as const;

/**
 * Platform (SuperAdmin) users.
 *
 * Credentials come from backend/.env so no password is committed to Git:
 *   SEED_PLATFORM_ADMIN_EMAIL, SEED_PLATFORM_ADMIN_PASSWORD, SEED_PLATFORM_ADMIN_NAME (optional)
 *   SEED_PLATFORM_SUPPORT_EMAIL, SEED_PLATFORM_SUPPORT_PASSWORD, SEED_PLATFORM_SUPPORT_NAME (optional)
 *
 * Safe to run repeatedly:
 * - A missing user is created.
 * - An existing user keeps its id; name, role and ACTIVE status are refreshed.
 * - The password is only re-hashed when it differs from the stored one, and then the
 *   user's existing sessions are signed out (tokenVersion + 1).
 * - If an account's variables are not set, that account is skipped.
 */
const BCRYPT_ROUNDS = 12;
const MIN_PASSWORD_LENGTH = 12;

const platformAccounts: {
  label: string;
  prefix: string;
  role: PlatformRole;
  defaultName: string;
}[] = [
  {
    label: "Platform Admin",
    prefix: "SEED_PLATFORM_ADMIN",
    role: "PLATFORM_ADMIN",
    defaultName: "Platform Admin",
  },
  {
    label: "Platform Support",
    prefix: "SEED_PLATFORM_SUPPORT",
    role: "PLATFORM_SUPPORT",
    defaultName: "Platform Support",
  },
];

async function seedPlatformUsers() {
  console.log("Starting platform user seed...");

  for (const account of platformAccounts) {
    // The login endpoint lower-cases the email before looking it up, so store it the same way.
    const email = process.env[`${account.prefix}_EMAIL`]?.trim().toLowerCase();
    const password = process.env[`${account.prefix}_PASSWORD`];
    const name =
      process.env[`${account.prefix}_NAME`]?.trim() || account.defaultName;

    if (!email || !password) {
      console.log(
        `Skipped ${account.label}: set ${account.prefix}_EMAIL and ${account.prefix}_PASSWORD in .env`,
      );
      continue;
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      throw new Error(
        `${account.prefix}_PASSWORD must be at least ${MIN_PASSWORD_LENGTH} characters.`,
      );
    }

    const existing = await prisma.platformUser.findUnique({ where: { email } });

    if (!existing) {
      await prisma.platformUser.create({
        data: {
          name,
          email,
          role: account.role,
          status: "ACTIVE",
          passwordHash: await bcrypt.hash(password, BCRYPT_ROUNDS),
        },
      });
      console.log(`Created ${account.label}: ${email}`);
      continue;
    }

    const passwordChanged = !(await bcrypt.compare(
      password,
      existing.passwordHash,
    ));
    await prisma.platformUser.update({
      where: { id: existing.id },
      data: {
        name,
        role: account.role,
        status: "ACTIVE",
        ...(passwordChanged
          ? {
              passwordHash: await bcrypt.hash(password, BCRYPT_ROUNDS),
              tokenVersion: { increment: 1 },
            }
          : {}),
      },
    });
    console.log(
      `Updated ${account.label}: ${email}${passwordChanged ? " (password changed, old sessions signed out)" : ""}`,
    );
  }

  console.log("Platform user seed completed.");
}

async function main() {
  console.log("Starting RBAC seed...");

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
        throw new Error(`Missing permission: ${permissionKey}`);
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

  console.log("RBAC seed completed successfully.");

  await seedPlatformUsers();
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
