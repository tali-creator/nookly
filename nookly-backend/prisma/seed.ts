import { PrismaClient, type UserRole } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";

dotenv.config();

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

// Broad, grouped taxonomy — related niches are folded into a single category
// to avoid a long, repetitive list (e.g. all repair trades -> "Home Services
// & Repairs"; fitness + personal training -> "Fitness & Sports").
const STARTER_CATEGORIES = [
  "Food & Drink",
  "Beauty & Salons",
  "Fitness & Sports",
  "Health & Wellness",
  "Home Services & Repairs",
  "Automotive",
  "Moving & Logistics",
  "Real Estate & Property",
  "Retail & Shops",
  "Pets & Vets",
  "Professional & Business",
  "Events & Lifestyle",
];

async function main(): Promise<void> {
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? "admin@nookly.local";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "";

  if (!adminPassword) {
    throw new Error("SEED_ADMIN_PASSWORD is not set in .env");
  }

  // Reset the category taxonomy only when no businesses exist yet, so we never
  // drop a category that a business depends on (the relation is required).
  if ((await prisma.business.count()) === 0) {
    await prisma.category.deleteMany({});
    console.log("Cleared existing categories for taxonomy reset");
  }

  for (const name of STARTER_CATEGORIES) {
    await prisma.category.upsert({
      where: { name },
      update: {},
      create: { name },
    });
    console.log(`Category ensured: ${name}`);
  }

  const passwordHash = await bcrypt.hash(adminPassword, 10);
  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: { role: "ADMIN" as UserRole },
    create: {
      email: adminEmail,
      passwordHash,
      role: "ADMIN" as UserRole,
    },
  });
  console.log(`Admin user ensured: ${admin.email} (role: ${admin.role})`);
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
