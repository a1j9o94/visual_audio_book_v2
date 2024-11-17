// Import dotenv config first, before any other imports
import 'dotenv/config';
import { addJob } from './queues';
import { globalDb } from '~/server/db/utils';
import { books, sequences, sequenceMedia, sequenceMetadata } from '~/server/db/schema';
import { bookProcessingWorker, sequenceProcessingWorker, sceneAnalysisWorker, audioGenerationWorker, imageGenerationWorker } from './workers';
import { eq, inArray } from 'drizzle-orm';
import { QUEUE_NAMES } from './config';
import { withRetry } from "~/server/db/utils";
import type { DrizzleClient } from "~/server/db/utils";

const NUM_TEST_SEQUENCES = 3;

async function waitForJobCompletion(sequenceId: string, sequenceNumber: number, db: DrizzleClient) {
  const maxAttempts = 240; // 20 minutes total with 5-second intervals
  let attempts = 0;
  
  while (attempts < maxAttempts) {
    const sequence = await withRetry(() => db.query.sequences.findFirst({
      where: eq(sequences.id, sequenceId)
    }));

    if (!sequence) {
      throw new Error(`Sequence ${sequenceId} (${sequenceNumber}/${NUM_TEST_SEQUENCES}) not found`);
    }

    console.log(`[Sequence ${sequenceNumber}/${NUM_TEST_SEQUENCES}] Status: ${sequence.status}`);

    // Check if sequence is in a final state
    if (sequence.status === 'completed' || sequence.status === 'failed') {
      if (sequence.status === 'failed') {
        throw new Error(`Sequence ${sequenceId} (${sequenceNumber}/${NUM_TEST_SEQUENCES}) processing failed`);
      }
      return;
    }

    // Wait 5 seconds before next check
    await new Promise(resolve => setTimeout(resolve, 5000));
    attempts++;
  }

  throw new Error(`Timeout waiting for sequence ${sequenceId} (${sequenceNumber}/${NUM_TEST_SEQUENCES}) to complete`);
}

async function testQueue() {
  console.log('=== Starting Queue Test ===');
  console.log(`Testing with ${NUM_TEST_SEQUENCES} sequences`);
  
  // Clean up any existing test data
  console.log('Cleaning up any existing test data...');
  await withRetry(async () => {
    await globalDb.transaction(async (tx) => {
      const existingBook = await tx.query.books.findFirst({
        where: eq(books.gutenbergId, '84')
      });

      if (existingBook) {
        await tx.delete(sequenceMedia)
          .where(
            inArray(
              sequenceMedia.sequenceId,
              tx.select({ id: sequences.id })
                .from(sequences)
                .where(eq(sequences.bookId, existingBook.id))
            )
          );
        
        await tx.delete(sequenceMetadata)
          .where(
            inArray(
              sequenceMetadata.sequenceId,
              tx.select({ id: sequences.id })
                .from(sequences)
                .where(eq(sequences.bookId, existingBook.id))
            )
          );
        
        await tx.delete(sequences)
          .where(eq(sequences.bookId, existingBook.id));
        
        await tx.delete(books)
          .where(eq(books.id, existingBook.id));
      }
    });
  });

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
    gutenbergId: '84',
    status: 'pending',
  }).returning();

  if (!book) throw new Error('Failed to create test book');

  let sequenceRecords: typeof sequences.$inferSelect[] = [];

  try {
    console.log('\n=== Creating Test Book ===');
    
    // Queue the book processing job
    await addJob({
      type: 'book-processing',
      data: {
        bookId: book.id,
        gutenbergId: book.gutenbergId ?? '',
        numSequences: NUM_TEST_SEQUENCES,
      }
    });

    // Wait for sequences to be created
    console.log('\n=== Waiting for Sequence Creation ===');
    let attempts = 0;
    while (attempts < 12) { // 1 minute total
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      sequenceRecords = await globalDb.query.sequences.findMany({
        where: eq(sequences.bookId, book.id),
        orderBy: (sequences, { asc }) => [asc(sequences.sequenceNumber)],
        limit: NUM_TEST_SEQUENCES,
      });

      if (sequenceRecords.length === NUM_TEST_SEQUENCES) {
        break;
      }
      attempts++;
    }

    if (sequenceRecords.length !== NUM_TEST_SEQUENCES) {
      throw new Error(`Expected ${NUM_TEST_SEQUENCES} sequences, but got ${sequenceRecords.length}`);
    }

    console.log(`\n=== Processing ${sequenceRecords.length} Sequences ===`);

    // Process each sequence
    for (const sequence of sequenceRecords) {
      console.log(`\n--- Processing Sequence ${sequence.sequenceNumber + 1}/${NUM_TEST_SEQUENCES} ---`);
      console.log(`Sequence ID: ${sequence.id}`);
      
      await waitForJobCompletion(sequence.id, sequence.sequenceNumber + 1, globalDb);
      
      console.log(`\n=== Verifying Sequence ${sequence.sequenceNumber + 1}/${NUM_TEST_SEQUENCES} ===`);

      // Verify metadata and media
      const [metadata, media] = await Promise.all([
        globalDb.query.sequenceMetadata.findFirst({
          where: eq(sequenceMetadata.sequenceId, sequence.id)
        }),
        globalDb.query.sequenceMedia.findFirst({
          where: eq(sequenceMedia.sequenceId, sequence.id)
        })
      ]);
      
      if (!metadata?.sceneDescription) {
        throw new Error(`Missing metadata for sequence ${sequence.sequenceNumber + 1}/${NUM_TEST_SEQUENCES}`);
      }

      if (!media?.audioUrl || !media?.imageUrl) {
        throw new Error(`Missing media data for sequence ${sequence.sequenceNumber + 1}/${NUM_TEST_SEQUENCES}`);
      }

      // Verify the media data is valid base64
      try {
        if (media.audioUrl) {
          Buffer.from(media.audioUrl, 'base64');
        }
        if (media.imageUrl) {
          Buffer.from(media.imageUrl, 'base64');
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        throw new Error(`Invalid media data format for sequence ${sequence.sequenceNumber + 1}/${NUM_TEST_SEQUENCES}: ${message}`);
      }

      console.log(`Sequence ${sequence.sequenceNumber + 1}/${NUM_TEST_SEQUENCES} completed successfully`);
    }

    console.log('\n=== All Tests Passed Successfully! ===');

  } catch (error) {
    console.error('\n=== Test Failed ===');
    console.error(error);
    throw error;
  } finally {
    // Cleanup
    console.log('Cleaning up test data...');
    try {
      await withRetry(async () => {
        await globalDb.transaction(async (tx) => {
          if (sequenceRecords.length > 0) {
            const sequenceIds = sequenceRecords.map(s => s.id);
            
            await tx.delete(sequenceMedia)
              .where(inArray(sequenceMedia.sequenceId, sequenceIds));
            
            await tx.delete(sequenceMetadata)
              .where(inArray(sequenceMetadata.sequenceId, sequenceIds));
            
            await tx.delete(sequences)
              .where(eq(sequences.bookId, book.id));
          }
          
          await tx.delete(books)
            .where(eq(books.id, book.id));
        });
      }, 5);
      console.log('Test cleanup completed');
    } catch (error) {
      console.error('Cleanup failed:', error);
      throw error;
    }
  }
}

void testQueue().catch(error => {
  console.error('\n=== Test Failed with Error ===');
  console.error(error);
  process.exit(1);
});