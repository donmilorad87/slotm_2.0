import { PrismaClient } from "../generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";

export type { PrismaClient } from "../generated/prisma/client.js";

let instance: PrismaClient | null = null;

export function getPrisma(): PrismaClient {
  if (!instance) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL environment variable is not set");
    }
    const adapter = new PrismaPg({ connectionString });
    instance = new PrismaClient({ adapter });
  }
  return instance;
}

export async function connectPrisma(): Promise<void> {
  await getPrisma().$connect();
}

export async function disconnectPrisma(): Promise<void> {
  if (instance) {
    await instance.$disconnect();
    instance = null;
  }
}
