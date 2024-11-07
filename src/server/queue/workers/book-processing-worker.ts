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

    console.log(`Fetched book content for ${gutenbergId}, length: ${bookContent.length} characters`);

    // Split into sequences
    const sequenceLength = 200; // words
    const words: string[] = bookContent.split(/\s+/).filter(word => word.length > 0);
    console.log('Total words found:', words.length);

    const sequencesData: SequenceData[] = [];

    for (let i = 0; i < words.length; i += sequenceLength) {
      const sequenceWords = words.slice(i, i + sequenceLength);
      sequencesData.push({
        content: sequenceWords.join(' '),
        startPosition: i,
        endPosition: i + sequenceWords.length,
      });
    }

    console.log(`Created ${sequencesData.length} sequences from book content`);

    // Create sequences in database and queue for processing
    const limit = numSequences ?? sequencesData.length;
    console.log(`Will process ${limit} sequences`);
    
    // Before the loop
    console.log('Debug - Processing parameters:', {
      limit,
      totalSequences: sequencesData.length,
      firstSequenceContent: sequencesData[0]?.content.substring(0, 100)
    });

    const db = createDb();

    for (let i = 0; i < limit; i++) {
      const sequence = sequencesData[i];
      if (!sequence) {
        console.warn(`No sequence data found for index ${i}`);
        continue;
      }

      try {
        const [sequenceRecord] = await db.insert(sequences).values({
          bookId,
          sequenceNumber: i,
          content: sequence.content,
          startPosition: sequence.startPosition,
          endPosition: sequence.endPosition,
          status: 'pending',
        }).returning();

        console.log(`Created sequence ${i + 1}/${limit}, ID: ${sequenceRecord?.id}`);

        if (!sequenceRecord) {
          console.error(`Failed to create sequence record for index ${i}`);
          continue;
        }

        // Queue sequence for processing
        await addJob({
          type: 'sequence-processing',
          data: {
            sequenceId: sequenceRecord.id,
            bookId,
            content: sequence.content,
          },
        });

        console.log(`Queued sequence ${sequenceRecord.id} for processing`);
      } catch (error) {
        console.error(`Error processing sequence ${i}:`, error);
        throw error;
      }
    }

    // After the loop
    const createdSequences = await db.query.sequences.findMany({
      where: eq(sequences.bookId, bookId)
    });
    console.log('Debug - Created sequences count:', createdSequences.length);

    // Update book status
    await withRetry(() =>
      db.update(books)
        .set({ status: 'processed' })
        .where(eq(books.id, bookId))
    );

    console.log(`Completed processing book ${bookId}, updating status`);
  },
  queueOptions
); 