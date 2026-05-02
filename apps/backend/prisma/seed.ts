import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const DEFAULT_ADMIN_USERNAME = 'admin';
const DEFAULT_ADMIN_PASSWORD = '123456';
const BCRYPT_ROUNDS = 10;

async function main() {
  const passwordHash = await bcrypt.hash(DEFAULT_ADMIN_PASSWORD, BCRYPT_ROUNDS);

  const admin = await prisma.admin.upsert({
    where: { username: DEFAULT_ADMIN_USERNAME },
    update: { passwordHash },
    create: {
      username: DEFAULT_ADMIN_USERNAME,
      passwordHash,
    },
  });

  console.log(`Seeded admin: id=${admin.id}, username=${admin.username}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
