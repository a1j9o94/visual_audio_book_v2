// Import dotenv config first, before any other imports
import 'dotenv/config';
import { addJob } from './queues';
import { db } from '~/server/db';
import { books, sequences } from '~/server/db/schema';
import { eq } from 'drizzle-orm';

async function testQueue() {
  // First create a test book record
  const [book] = await db.insert(books).values({
    title: 'Test Book',
    author: 'Test Author',
    gutenbergId: '1234',
    status: 'pending',
    // Add other required fields based on your schema
  }).returning();

  if (!book) throw new Error('Failed to create test book');

  try {
    // Queue the job with the actual book ID
    await addJob({
      type: 'book-processing',
      data: {
        bookId: book.id,
        gutenbergId: book.gutenbergId ?? ''
      }
    });
    
    console.log('Test job added for book:', book.id);

    // Wait a bit for processing to complete (adjust time as needed)
    await new Promise(resolve => setTimeout(resolve, 5000));

  } finally {
    // Cleanup: Delete sequences first due to foreign key constraints
    await db.delete(sequences).where(eq(sequences.bookId, book.id));
    await db.delete(books).where(eq(books.id, book.id));
    console.log('Test cleanup completed');
  }
}

void testQueue().catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});