import { Worker } from "bullmq";
import { createDb } from "~/server/db/utils";
import { queueOptions, QUEUE_NAMES } from "../config";
import { books, sequences } from "~/server/db/schema";
import { addJob } from "../queues";
import { eq } from "drizzle-orm";
import axios from "axios";
import { withRetry } from "~/server/db/utils";

interface BookProcessingJob {
  bookId: string;
  gutenbergId: string;
  numSequences: number | undefined;
}

interface SequenceData {
  content: string;
  startPosition: number;
  endPosition: number;
}

export const bookProcessingWorker = new Worker<BookProcessingJob>(
  QUEUE_NAMES.BOOK_PROCESSING,
  async (job) => {
    console.log('Starting book processing job:', job.data);
    const { bookId, gutenbergId, numSequences } = job.data;

    const editionUrl = `https://www.gutenberg.org/cache/epub/${gutenbergId}/pg${gutenbergId}.txt`;
    let bookContent: string;
    try {
      console.log('Fetching book content from:', editionUrl);
      const response = await axios.get<string>(editionUrl, { responseType: 'text' });
      bookContent = response.data;
      console.log('Book content length:', bookContent.length);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`Error in bookProcessingWorker for book ${bookId}:`, {
        error: errorMessage,
        jobData: job.data,
        timestamp: new Date().toISOString()
      });
      throw new Error(`Failed to fetch book content: ${errorMessage}. URL: ${editionUrl}`);
    }

    if (!bookContent || bookContent.length === 0) {
      throw new Error('Retrieved book content is empty');
    }

    // Split into sequences
    const sequenceLength = 50; // words
    const words: string[] = bookContent.split(/\s+/).filter(word => word.length > 0);
    console.log(`Total words found: ${words.length}, requested sequences: ${numSequences}`);

    const maxPossibleSequences = Math.floor(words.length / sequenceLength);
    const actualLimit = Math.min(numSequences ?? maxPossibleSequences, maxPossibleSequences);
    
    console.log(`Will create ${actualLimit} sequences (max possible: ${maxPossibleSequences})`);

    const sequencesData: SequenceData[] = [];
    for (let i = 0; i < actualLimit; i++) {
      const start = i * sequenceLength;
      const end = (i + 1) * sequenceLength;
      const sequenceWords = words.slice(start, end);
      sequencesData.push({
        content: sequenceWords.join(' '),
        startPosition: start,
        endPosition: start + sequenceWords.length,
      });
    }

    console.log(`Created ${sequencesData.length} sequence chunks`);
    
    const db = createDb();

    try {
      // Create sequences in database and queue for processing
      for (let i = 0; i < sequencesData.length; i++) {
        const sequence = sequencesData[i];
        if (!sequence) {
          console.error(`Sequence data is undefined for index ${i}`);
          continue;
        }
        
        console.log(`Processing sequence ${i + 1}/${actualLimit}`);
        
        const [sequenceRecord] = await db.insert(sequences).values({
          bookId,
          sequenceNumber: i,
          content: sequence.content,
          startPosition: sequence.startPosition,
          endPosition: sequence.endPosition,
          status: 'pending',
        }).returning();

        if (!sequenceRecord) {
          console.error(`Failed to create sequence record for index ${i}`);
          continue;
        }

        console.log(`[Sequence ${i + 1}/${actualLimit}] Created with ID: ${sequenceRecord.id}`);

        // Queue sequence for processing
        await addJob({
          type: 'sequence-processing',
          data: {
            sequenceId: sequenceRecord.id,
            bookId,
            content: sequence.content,
            sequenceNumber: i + 1,
            totalSequences: actualLimit
          },
        });

        console.log(`[Sequence ${i + 1}/${actualLimit}] Queued for processing`);
      }

      // Update book status
      await withRetry(() =>
        db.update(books)
          .set({ status: 'processed' })
          .where(eq(books.id, bookId))
      );

      console.log(`Completed processing book ${bookId} with ${actualLimit} sequences`);
    } catch (error) {
      console.error(`Error in bookProcessingWorker for book ${bookId}:`, error);
    }
  },
  queueOptions
); 