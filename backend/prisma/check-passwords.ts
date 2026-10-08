
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const accounts = [
    {
      email: 'admin@branchsuite.test',
      password: 'Admin@Test123',
    },
    {
      email: 'employee@branchsuite.test',
      password: 'Employee@Test123',
    },
  ];

  for (const account of accounts) {
    const user = await prisma.user.findUnique({
      where: {
        email: account.email,
      },
    });

    const passwordMatches = user
      ? await bcrypt.compare(account.password, user.password)
      : false;

    console.log({
      email: account.email,
      exists: Boolean(user),
      passwordMatches,
      status: user?.status ?? 'NOT_FOUND',
    });
  }
}

main()
  .catch((error) => {
    console.error('Password check failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
