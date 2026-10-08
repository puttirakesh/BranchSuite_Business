"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const client_1 = require("@prisma/client");
const bcrypt = require("bcrypt");
const prisma = new client_1.PrismaClient();
const TENANT_NAME = 'BranchSuite Business';
const COMPANY_NAME = 'BranchSuite Demo Company';
const BRANCH_NAME = 'Main Branch';
const ADMIN_EMAIL = 'admin@branchsuite.test';
const EMPLOYEE_EMAIL = 'employee@branchsuite.test';
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? 'Admin@Test123';
const EMPLOYEE_PASSWORD = process.env.SEED_EMPLOYEE_PASSWORD ?? 'Employee@Test123';
async function main() {
    let tenant = await prisma.tenant.findFirst({
        where: { name: TENANT_NAME },
    });
    if (!tenant) {
        tenant = await prisma.tenant.create({
            data: {
                name: TENANT_NAME,
                status: client_1.RecordStatus.ACTIVE,
            },
        });
    }
    let company = await prisma.company.findFirst({
        where: {
            tenantId: tenant.id,
            name: COMPANY_NAME,
        },
    });
    if (!company) {
        company = await prisma.company.create({
            data: {
                tenantId: tenant.id,
                name: COMPANY_NAME,
                status: client_1.RecordStatus.ACTIVE,
            },
        });
    }
    let branch = await prisma.branch.findFirst({
        where: {
            companyId: company.id,
            name: BRANCH_NAME,
        },
    });
    if (!branch) {
        branch = await prisma.branch.create({
            data: {
                companyId: company.id,
                name: BRANCH_NAME,
                status: client_1.RecordStatus.ACTIVE,
            },
        });
    }
    const adminRole = await prisma.role.upsert({
        where: { name: 'BUSINESS_ADMIN' },
        update: {},
        create: {
            name: 'BUSINESS_ADMIN',
            description: 'Business administrator',
        },
    });
    const employeeRole = await prisma.role.upsert({
        where: { name: 'EMPLOYEE' },
        update: {},
        create: {
            name: 'EMPLOYEE',
            description: 'Business employee',
        },
    });
    async function createTestUser(name, email, password, roleId) {
        const existingUser = await prisma.user.findUnique({
            where: { email },
        });
        const user = existingUser
            ? existingUser
            : await prisma.user.create({
                data: {
                    tenantId: tenant.id,
                    name,
                    email,
                    password: await bcrypt.hash(password, 12),
                    status: client_1.UserStatus.ACTIVE,
                },
            });
        if (user.tenantId !== tenant.id) {
            throw new Error(`User ${email} belongs to another tenant.`);
        }
        await prisma.userRole.upsert({
            where: {
                userId_roleId: {
                    userId: user.id,
                    roleId,
                },
            },
            update: {},
            create: {
                userId: user.id,
                roleId,
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
        return user;
    }
    await createTestUser('Business Administrator', ADMIN_EMAIL, ADMIN_PASSWORD, adminRole.id);
    await createTestUser('Test Employee', EMPLOYEE_EMAIL, EMPLOYEE_PASSWORD, employeeRole.id);
    console.log('\nBranchSuite test accounts are ready.');
    console.log('Tenant:', tenant.name);
    console.log('Tenant ID:', tenant.id);
    console.log('Company:', company.name);
    console.log('Branch:', branch.name);
    console.log('Admin email:', ADMIN_EMAIL);
    console.log('Employee email:', EMPLOYEE_EMAIL);
    console.log('Existing user passwords were preserved if accounts already existed.');
}
main()
    .catch((error) => {
    console.error('Seed failed:', error);
    process.exitCode = 1;
})
    .finally(async () => {
    await prisma.$disconnect();
});
//# sourceMappingURL=seed.js.map