import { PrismaClient } from "@prisma/client";

// A single shared PrismaClient instance — creating a new one per request
// would exhaust the database's connection pool.
export const prisma = new PrismaClient();
