import { Worker } from "bullmq";
import { db } from "~/server/db";
import { queueOptions, QUEUE_NAMES } from "../config";
import { books, sequences } from "~/server/db/schema";
import { addJob } from "../queues";
import { eq } from "drizzle-orm";
import axios from "axios";

interface BookProcessingJob {
  bookId: string;
  gutenbergId: string;
}

interface SequenceData {
  content: string;
  startPosition: number;
  endPosition: number;
}

export const bookProcessingWorker = new Worker<BookProcessingJob>(
  QUEUE_NAMES.BOOK_PROCESSING,
  async (job) => {
    const { bookId, gutenbergId } = job.data;

    const editionUrl = `https://www.gutenberg.org/cache/epub/${gutenbergId}/pg${gutenbergId}.txt`;
    let bookContent: string;
    try {
      const response = await axios.get<string>(editionUrl, { responseType: 'text' });
      bookContent = response.data;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to fetch book content: ${errorMessage}`);
    }

    // Split into sequences
    const sequenceLength = 200; // words
    const words: string[] = bookContent.split(/\s+/);
    const sequencesData: SequenceData[] = [];
    
    for (let i = 0; i < words.length; i += sequenceLength) {
      const sequenceWords = words.slice(i, i + sequenceLength);
      sequencesData.push({
        content: sequenceWords.join(' '),
        startPosition: i,
        endPosition: i + sequenceWords.length,
      });
    }

    // Create sequences in database and queue for processing
    for (let i = 0; i < sequencesData.length; i++) {
      const sequence = sequencesData[i];
      if (!sequence) continue;
      const [sequenceRecord] = await db.insert(sequences).values({
        bookId,
        sequenceNumber: i,
        content: sequence.content,
        startPosition: sequence.startPosition,
        endPosition: sequence.endPosition,
      }).returning();

      // Queue sequence for processing
      if (!sequenceRecord) continue;
      await addJob({
        type: 'sequence-processing',
        data: {
          sequenceId: sequenceRecord.id,
          bookId,
          content: sequence.content,
        },
      });
    }

    // Update book status
    await db.update(books)
      .set({ status: 'processing' })
      .where(eq(books.id, bookId));
  },
  queueOptions
); 