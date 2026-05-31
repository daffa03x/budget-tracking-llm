import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient, type CategoryType } from "../lib/generated/prisma/client";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({ adapter });

const defaultCategories: Array<{
  name: string;
  icon: string;
  color: string;
  type: CategoryType;
}> = [
  { name: "Gaji", icon: "Banknote", color: "#16A34A", type: "income" },
  { name: "Bonus", icon: "Sparkles", color: "#0EA5E9", type: "income" },
  { name: "Makanan", icon: "Utensils", color: "#F97316", type: "expense" },
  { name: "Transport", icon: "Car", color: "#2563EB", type: "expense" },
  { name: "Belanja", icon: "ShoppingBag", color: "#DB2777", type: "expense" },
  { name: "Tagihan", icon: "ReceiptText", color: "#7C3AED", type: "expense" },
  { name: "Kesehatan", icon: "HeartPulse", color: "#DC2626", type: "expense" },
  { name: "Hiburan", icon: "Clapperboard", color: "#9333EA", type: "expense" },
  { name: "Investasi", icon: "TrendingUp", color: "#059669", type: "both" },
  { name: "Lainnya", icon: "CircleEllipsis", color: "#64748B", type: "both" },
];

async function main() {
  for (const category of defaultCategories) {
    const existingCategory = await prisma.category.findFirst({
      where: {
        name: category.name,
        isDefault: true,
        userId: null,
      },
      select: {
        id: true,
      },
    });

    if (existingCategory) {
      await prisma.category.update({
        where: {
          id: existingCategory.id,
        },
        data: {
          icon: category.icon,
          color: category.color,
          type: category.type,
        },
      });

      continue;
    }

    await prisma.category.create({
      data: {
        ...category,
        isDefault: true,
      },
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
