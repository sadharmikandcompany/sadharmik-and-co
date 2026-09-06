import { PrismaClient } from "@prisma/client";
import { computeOrderTotals } from "../lib/money";

const prisma = new PrismaClient();

const FLAVOURS = [
  "Ghee Sada",
  "Ghee Jeera",
  "Methi Masala",
  "Special Masala",
  "Methi",
  "Punjabi",
  "Nachani",
  "Jeera Masala",
];

async function main() {
  for (const name of FLAVOURS) {
    await prisma.product.upsert({
      where: { name },
      update: {},
      create: { name, packSize: "500g", price: 160, stock: 20 },
    });
  }

  const customer = await prisma.customer.upsert({
    where: { id: "seed-customer-priya" },
    update: {},
    create: {
      id: "seed-customer-priya",
      firstName: "Priya",
      lastName: "Shah",
      mobilePrimary: "9820012345",
      whatsapp: "9820012345",
      shippingAddress: "12 Laxmi Nivas, Ghatkopar East, Mumbai 400077",
    },
  });

  const supplier = await prisma.supplier.upsert({
    where: { id: "seed-supplier-om" },
    update: {},
    create: {
      id: "seed-supplier-om",
      name: "Om Flour Mills",
      phone: "9821099999",
      itemsSupplied: "Wheat flour, packaging",
    },
  });

  const gheeSada = await prisma.product.findUniqueOrThrow({ where: { name: "Ghee Sada" } });
  const methi = await prisma.product.findUniqueOrThrow({ where: { name: "Methi" } });

  const totals = computeOrderTotals([
    { quantity: 2, unitPrice: gheeSada.price },
    { quantity: 1, unitPrice: methi.price },
  ]);

  const existingOrder = await prisma.order.findUnique({ where: { orderNumber: "SDK000000001" } });
  if (!existingOrder) {
    await prisma.order.create({
      data: {
        orderNumber: "SDK000000001",
        customerId: customer.id,
        status: "DELIVERED",
        source: "WHATSAPP",
        subtotal: totals.subtotal,
        deliveryCharge: totals.delivery,
        total: totals.total,
        items: {
          create: [
            { productId: gheeSada.id, quantity: 2, unitPrice: gheeSada.price },
            { productId: methi.id, quantity: 1, unitPrice: methi.price },
          ],
        },
      },
    });
  }

  const existingPurchase = await prisma.purchase.findFirst({ where: { supplierId: supplier.id } });
  if (!existingPurchase) {
    await prisma.purchase.create({
      data: {
        supplierId: supplier.id,
        total: 25 * 40,
        paidStatus: "PAID",
        items: {
          create: [{ itemName: "Wheat flour", quantity: 25, unit: "kg", rate: 40, amount: 25 * 40 }],
        },
      },
    });
  }

  console.log(`Seeded ${FLAVOURS.length} products, 1 customer, 1 supplier, 1 order, 1 purchase.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
