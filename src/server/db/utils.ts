import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

export type DrizzleClient = ReturnType<typeof drizzle<typeof schema>>;

interface DrizzleInternals {
  $query: {
    client: postgres.Sql;
  };
}

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not defined');
}

const DEFAULT_PG_CONFIG = {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
  statement_timeout: 30000,
  idle_in_transaction_session_timeout: 30000,
} as const;

// Create the SQL client
const sql = postgres(process.env.DATABASE_URL, DEFAULT_PG_CONFIG);

// Create the global database instance
export const globalDb = drizzle(sql, { schema });

// For workers that need their own connection
export function createDb() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not defined');
  }
  const sql = postgres(process.env.DATABASE_URL, DEFAULT_PG_CONFIG);
  return drizzle(sql, { schema });
}

// Helper to close a database connection
export async function closeDb(db: DrizzleClient) {
  if (!db) {
    return;
  }
  // Cast to our internal interface instead of any
  const client = (db as unknown as DrizzleInternals).$query.client;
  await client.end();
}

// Retry helper with exponential backoff
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelay = 100
): Promise<T> {
  let lastError: unknown;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (i < maxRetries - 1) {
        await new Promise(resolve => 
          setTimeout(resolve, baseDelay * Math.pow(2, i))
        );
      }
    }
  }
  
  throw lastError;
}
