import postgres from 'postgres';
import { drizzle } from "drizzle-orm/postgres-js";
import { env } from "~/env";
import * as schema from "./schema";

async function wait(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries = 3,
  baseDelay = 100
): Promise<T> {
  let lastError: Error | undefined;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      
      if (error instanceof postgres.PostgresError && 
          ['40001', '40P01'].includes((error).code)) {
        const delay = baseDelay * Math.pow(2, attempt);
        console.log(`Database conflict, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`);
        await wait(delay);
        continue;
      }
      
      throw error;
    }
  }
  
  throw lastError!;
}

// Create a single shared pool
const globalPool = postgres(env.DATABASE_URL, { 
  max: 10, // Increase max connections but keep it reasonable
  idle_timeout: 20, // Close idle connections after 20 seconds
  connect_timeout: 10, // Connection timeout after 10 seconds
});

export const globalDb = drizzle(globalPool, { schema });

// For workers that need their own connection
export function createDb() {
  const client = postgres(env.DATABASE_URL, { 
    max: 1,
    idle_timeout: 20,
  });
  return drizzle(client, { schema });
}

export type DrizzleClient = ReturnType<typeof createDb>;

export async function closeDb(db: DrizzleClient) {
  // @ts-expect-error - internal property access
  await db.session?.end();
}
