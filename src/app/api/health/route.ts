import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm'
import { db } from '~/server/db';
import { statusCheckQueue } from '~/server/queue/queues';

export async function GET() {
  try {
    // Test database connection
    await db.execute(sql`SELECT 1`);
    
    // Test Redis connection through BullMQ
    const client = await statusCheckQueue.client;
    const redisStatus = await client.ping();
    
    if (redisStatus !== 'PONG') {
      throw new Error('Redis connection failed');
    }

    return NextResponse.json(
      { status: 'healthy', services: { database: 'connected', redis: 'connected' } },
      { status: 200 }
    );
  } catch (error) {
    console.error('Health check failed:', error);
    return NextResponse.json(
      { 
        status: 'unhealthy', 
        error: String(error),
        services: {
          database: error instanceof Error && error.message.includes('Redis') ? 'connected' : 'disconnected',
          redis: error instanceof Error && error.message.includes('Redis') ? 'disconnected' : 'connected'
        }
      },
      { status: 500 }
    );
  }
}
