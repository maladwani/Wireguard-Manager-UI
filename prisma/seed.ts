import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const existingAdmin = await prisma.user.findFirst({
    where: { role: "super_admin" },
  });

  if (!existingAdmin) {
    const hashedPassword = await bcrypt.hash("changeme", 12);
    await prisma.user.create({
      data: {
        name: "Super Admin",
        email: "admin@wireguard.local",
        hashedPassword,
        role: "super_admin",
      },
    });
    console.log("Default super admin created: admin@wireguard.local / changeme");
  } else {
    console.log("Super admin already exists, skipping seed.");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
