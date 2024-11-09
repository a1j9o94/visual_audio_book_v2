import { Worker } from "bullmq";
import { createDb, closeDb } from "~/server/db/utils";
import { queueOptions, QUEUE_NAMES } from "../config";
import { books, sequences } from "~/server/db/schema";
import { addJob } from "../queues";
import { eq, and, lte, gt } from "drizzle-orm";
import axios from "axios";
import { withRetry } from "~/server/db/utils";

interface BookProcessingJob {
  bookId: string;
  gutenbergId: string;
  numSequences: number | undefined;
}

type SequenceInsert = typeof sequences.$inferInsert;

export const bookProcessingWorker = new Worker<BookProcessingJob>(
  QUEUE_NAMES.BOOK_PROCESSING,
  async (job) => {
    console.log('Starting book processing job:', job.data);
    const { bookId, gutenbergId, numSequences } = job.data;
    const db = createDb();

    try {
      // Check if book already has sequences
      const existingSequences = await db.query.sequences.findMany({
        where: eq(sequences.bookId, bookId),
        orderBy: (sequences, { desc }) => [desc(sequences.sequenceNumber)],
      });

      if (existingSequences.length === 0) {
        // First time processing - fetch and split book content
        const editionUrl = `https://www.gutenberg.org/cache/epub/${gutenbergId}/pg${gutenbergId}.txt`;
        console.log('Fetching book content from:', editionUrl);
        const response = await axios.get<string>(editionUrl, { responseType: 'text' });
        const bookContent = response.data;

        if (!bookContent || bookContent.length === 0) {
          throw new Error('Retrieved book content is empty');
        }

        // Split into sequences
        const sequenceLength = 50; // words
        const words = bookContent.split(/\s+/).filter(word => word.length > 0);
        console.log(`Total words found: ${words.length}`);

        // Prepare all sequence records
        const sequenceRecords: SequenceInsert[] = [];
        for (let i = 0; i < words.length; i += sequenceLength) {
          const sequenceWords = words.slice(i, i + sequenceLength);
          sequenceRecords.push({
            bookId,
            sequenceNumber: Math.floor(i / sequenceLength),
            content: sequenceWords.join(' '),
            startPosition: i,
            endPosition: i + sequenceWords.length,
            status: 'pending',
          });
        }

        // Use transaction and batch insert for better performance
        await withRetry(() => 
          db.transaction(async (tx) => {
            // Insert sequences in chunks to avoid hitting database limits
            const chunkSize = 1000;
            for (let i = 0; i < sequenceRecords.length; i += chunkSize) {
              const chunk = sequenceRecords.slice(i, i + chunkSize);
              await tx.insert(sequences).values(chunk);
            }
          })
        );

        console.log(`Created ${sequenceRecords.length} sequence records`);
      }

      // Process the requested number of pending sequences
      if (numSequences) {
        const lastProcessedSequence = existingSequences.find(seq => 
          seq.status !== 'pending' && seq.status !== 'failed'
        );
        
        const lastProcessedNumber = lastProcessedSequence 
          ? lastProcessedSequence.sequenceNumber 
          : -1;

        const sequencesToProcess = await db.query.sequences.findMany({
          where: and(
            eq(sequences.bookId, bookId),
            eq(sequences.status, 'pending'),
            gt(sequences.sequenceNumber, lastProcessedNumber),
            lte(sequences.sequenceNumber, lastProcessedNumber + numSequences)
          ),
          orderBy: (sequences, { asc }) => [asc(sequences.sequenceNumber)],
        });

        console.log(`Processing ${sequencesToProcess.length} sequences`);

        // Queue sequences for processing
        for (const sequence of sequencesToProcess) {
          await addJob({
            type: 'sequence-processing',
            data: {
              sequenceId: sequence.id,
              bookId,
              content: sequence.content,
              sequenceNumber: sequence.sequenceNumber + 1,
              totalSequences: numSequences,
            },
          });
        }
      }

      // Update book status
      await withRetry(() =>
        db.update(books)
          .set({ status: numSequences ? 'processing' : 'text-ready' })
          .where(eq(books.id, bookId))
      );

      console.log(`Completed processing for book ${bookId}`);
    } catch (error) {
      console.error(`Error in bookProcessingWorker for book ${bookId}:`, error);
      await withRetry(() =>
        db.update(books)
          .set({ status: 'failed' })
          .where(eq(books.id, bookId))
      );
      throw error;
    } finally {
      await closeDb(db);
    }
  },
  queueOptions
); 