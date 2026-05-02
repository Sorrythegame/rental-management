/* eslint-disable */
const { PrismaClient } = require('@prisma/client');
(async () => {
  const p = new PrismaClient();
  const cnt = await p.asset.count();
  console.log('Asset count:', cnt);
  if (cnt > 0) {
    const rows = await p.asset.findMany();
    console.log('Sample:', rows.slice(0, 3));
  }
  await p.$disconnect();
})();
