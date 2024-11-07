// Import dotenv config first, before any other imports
import 'dotenv/config';
import { addJob } from './queues';
import { globalDb } from '~/server/db/utils';
import { books, sequences, sequenceMedia, sequenceMetadata } from '~/server/db/schema';
import { bookProcessingWorker, sequenceProcessingWorker, sceneAnalysisWorker, audioGenerationWorker, imageGenerationWorker } from './workers';
import { eq, inArray } from 'drizzle-orm';
import { getMediaStorage } from '~/server/storage';
import { QUEUE_NAMES } from './config';
import { withRetry } from "~/server/db/utils";

const TIMEOUT_MS = 120000; // 2 minutes

async function waitForJobCompletion(sequenceId: string, db: unknown) {
  const maxAttempts = 60; // 5 minutes total with 5-second intervals
  let attempts = 0;
  while (attempts < maxAttempts) {
    const sequence = await withRetry(() => db.query.sequences.findFirst({
      where: eq(sequences.id, sequenceId)
    }));

    if (!sequence) {
      throw new Error(`Sequence ${sequenceId} not found`);
    }

    // Check if sequence is in a final state
    if (sequence.status === 'completed' || sequence.status === 'failed') {
      if (sequence.status === 'failed') {
        throw new Error(`Sequence ${sequenceId} processing failed`);
      }
      return;
    }

    // Wait 5 seconds before next check
    await new Promise(resolve => setTimeout(resolve, 5000));
    attempts++;
  }

  throw new Error(`Timeout waiting for sequence ${sequenceId} to complete`);
}

async function testQueue() {
  console.log('Cleaning up any existing test data...');
  const existingBook = await globalDb.query.books.findFirst({
    where: eq(books.gutenbergId, '84')
  });

  if (existingBook) {
    await globalDb.delete(sequences).where(eq(sequences.bookId, existingBook.id));
    await globalDb.delete(books).where(eq(books.id, existingBook.id));
    console.log('Cleaned up existing test book and sequences');
  }

  console.log('Checking worker status...');
  const workers = [
    bookProcessingWorker,
    sequenceProcessingWorker,
    sceneAnalysisWorker,
    audioGenerationWorker,
    imageGenerationWorker
  ];
  
  console.log('Worker names:', workers.map(w => w.name));
  console.log('Queue names:', Object.values(QUEUE_NAMES));

  for (const worker of workers) {
    if (!worker.isRunning()) {
      throw new Error(`Worker ${worker.name} is not running`);
    }
  }

  // Create a test book record
  const [book] = await globalDb.insert(books).values({
    title: 'Test Book',
    author: 'Test Author',
    gutenbergId: '84', // The Project Gutenberg copy of Frankenstein
    status: 'pending',
  }).returning();

  if (!book) throw new Error('Failed to create test book');

  let sequenceRecords: typeof sequences.$inferSelect[] = [];

  try {
    console.log('Starting book processing test...');
    
    await addJob({
      type: 'book-processing',
      data: {
        bookId: book.id,
        gutenbergId: book.gutenbergId ?? '',
        numSequences: 10,
      }
    });

    // Wait for sequences to be created
    await new Promise(resolve => setTimeout(resolve, 5000)); // Short wait for initial creation
    sequenceRecords = await globalDb.query.sequences.findMany({
      where: eq(sequences.bookId, book.id),
      limit: 10,
    });

    if (sequenceRecords.length === 0) {
      throw new Error('No sequences were created');
    }

    console.log(`Created ${sequenceRecords.length} sequences`);

    // Verify the results
    const storage = getMediaStorage();
    
    for (const sequence of sequenceRecords) {
      await waitForJobCompletion(sequence.id, globalDb);
      console.log(`Verifying sequence ${sequence.id}...`);

      // Check sequence metadata exists
      const metadata = await globalDb.query.sequenceMetadata.findFirst({
        where: eq(sequenceMetadata.sequenceId, sequence.id)
      });
      
      console.log('Metadata for sequence:', sequence.id, metadata);

      if (!metadata) {
        throw new Error(`No metadata found for sequence ${sequence.id}`);
      }

      if (!metadata.sceneDescription) {
        throw new Error(`Missing scene description for sequence ${sequence.id}`);
      }

      console.log('Scene description:', metadata.sceneDescription);

      // Check media exists
      const media = await globalDb.query.sequenceMedia.findFirst({
        where: eq(sequenceMedia.sequenceId, sequence.id)
      });

      if (!media?.audioUrl || !media?.imageUrl) {
        throw new Error(`Missing media for sequence ${sequence.id}`);
      }

      // Verify media files are accessible
      try {
        await storage.getAudioUrl(book.id, sequence.id);
        await storage.getImageUrl(book.id, sequence.id);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        throw new Error(`Failed to retrieve media files for sequence ${sequence.id}: ${errorMessage}`);
      }
    }

    console.log('All tests passed successfully!');

  } catch (error) {
    console.error('Test failed:', error);
    throw error;
  } finally {
    // Cleanup
    console.log('Cleaning up test data...');
    try {

      await withRetry(async () => {
        await globalDb.transaction(async (tx) => {
          // Delete in specific order to avoid deadlocks
          if (sequenceRecords.length > 0) {
            const sequenceIds = sequenceRecords.map(s => s.id);
            
            await tx.delete(sequenceMedia)
              .where(inArray(sequenceMedia.sequenceId, sequenceIds));
            
            await tx.delete(sequenceMetadata)
              .where(inArray(sequenceMetadata.sequenceId, sequenceIds));
            
            await tx.delete(sequences)
              .where(eq(sequences.bookId, book.id));
          }
          
          if (book) {
            await tx.delete(books)
              .where(eq(books.id, book.id));
          }
        });
      }, 5); // Increase max retries for cleanup
      console.log('Test cleanup completed');
    } catch (error) {
      console.error('Cleanup failed:', error);
      throw error;
    }
  }
}

void testQueue().catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});