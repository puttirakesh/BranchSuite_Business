
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const email = 'admin@branchsuite.test';

  const password = process.env.SEED_ADMIN_PASSWORD;

  if (!password || password.length < 12) {
    throw new Error(
      'Set SEED_ADMIN_PASSWORD to a password of at least 12 characters in backend/.env',
    );
  }

  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    throw new Error('Business Admin account not found');
  }

  const hashedPassword = await bcrypt.hash(password, 12);

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: { password: hashedPassword },
    });

    // Log out any existing sessions for this account.
    await tx.authSession.updateMany({
      where: {
        userId: user.id,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });
  });

  console.log('Business Admin password updated successfully');
  console.log('Email:', email);
}

main()
  .catch((error) => {
    console.error('Password reset failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
