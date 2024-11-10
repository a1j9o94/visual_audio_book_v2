import { Worker } from "bullmq";
import { queueOptions, QUEUE_NAMES } from "../config";
import { addJob } from "../queues";
import { sequences } from "~/server/db/schema";
import { eq } from "drizzle-orm";
import { withRetry } from "~/server/db/utils";
import { getDb } from "~/server/db/utils";

interface SequenceProcessingJob {
  sequenceId: string;
  bookId: string;
  content: string;
  sequenceNumber: number;
  totalSequences: number;
}

export const sequenceProcessingWorker = new Worker<SequenceProcessingJob>(
  QUEUE_NAMES.SEQUENCE_PROCESSING,
  async (job) => {
    const { sequenceId, bookId, content, sequenceNumber, totalSequences } = job.data;
    const db = getDb();

    console.log(`[Sequence ${sequenceNumber}/${totalSequences}] Starting processing`);

    try {
      // Set initial status
      await withRetry(() => 
        db.update(sequences)
          .set({ status: 'processing' })
          .where(eq(sequences.id, sequenceId))
      );

      // Queue both jobs in parallel
      await Promise.all([
        addJob({
          type: 'audio-generation',
          data: { 
            sequenceId, 
            text: content,
            sequenceNumber,
            totalSequences
          },
        }),
        addJob({
          type: 'scene-analysis',
          data: { 
            sequenceId, 
            content, 
            bookId,
            sequenceNumber,
            totalSequences
          },
        }),
      ]);

      console.log(`[Sequence ${sequenceNumber}/${totalSequences}] Successfully queued processing jobs`);
    } catch (error) {
      console.error(`[Sequence ${sequenceNumber}/${totalSequences}] Error:`, error);
      await withRetry(() =>
        db.update(sequences)
          .set({ status: 'failed' })
          .where(eq(sequences.id, sequenceId))
      );
      throw error;
    }
  },
  queueOptions
); 