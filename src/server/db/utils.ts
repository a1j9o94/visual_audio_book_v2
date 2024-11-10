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
  max: 20,
  idle_timeout: 20,
  connect_timeout: 10,
  statement_timeout: 30000,
  idle_in_transaction_session_timeout: 30000,
} as const;

// Create a single shared connection pool
const connectionPool = postgres(process.env.DATABASE_URL, DEFAULT_PG_CONFIG);

// Create the global database instance
export const globalDb = drizzle(connectionPool, { schema });

// For workers to get a connection from the pool
export function getDb() {
  return globalDb;
}

// Helper to properly release connections
export async function closeDb(db: DrizzleClient) {
  if (!db || !(db as unknown as DrizzleInternals).$query) {
    return;
  }
  // We don't actually close the connection, just return it to the pool
  // The pool will manage the connections automatically
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
