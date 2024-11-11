import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "~/env";
import * as schema from "./schema";
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';

const client = postgres(env.DATABASE_URL, { max: 1 });
export const db = drizzle(client, { schema });

export type DbType = typeof db;
export type Schema = typeof schema;
export type Transaction = PostgresJsDatabase<Schema>;
