const { PrismaClient } = require('./node_modules/@prisma/client');
const prisma = new PrismaClient();

async function clearData() {
  await prisma.orderItem.deleteMany({});
  await prisma.order.deleteMany({});
  await prisma.customer.deleteMany({});
  console.log("Cleared customers and orders");
}

clearData()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
