import { NextResponse } from 'next/server';
import { db } from '~/server/db';

export async function GET() {
  try {
    // Test database connection
    await db.execute(sql`SELECT 1`);
    
    return NextResponse.json(
      { status: 'healthy' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Health check failed:', error);
    return NextResponse.json(
      { status: 'unhealthy', error: String(error) },
      { status: 500 }
    );
  }
}
