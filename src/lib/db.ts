import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

const globalForDrizzle = globalThis as unknown as {
  db: ReturnType<typeof createDrizzleClient> | undefined;
};

function createDrizzleClient() {
  const sql = neon(process.env.DATABASE_URL!);
  return drizzle(sql, { schema });
}

export const db = globalForDrizzle.db ?? createDrizzleClient();

if (process.env.NODE_ENV !== "production") globalForDrizzle.db = db;
