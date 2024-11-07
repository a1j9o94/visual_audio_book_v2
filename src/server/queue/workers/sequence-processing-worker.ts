import { Worker } from "bullmq";
import { queueOptions, QUEUE_NAMES } from "../config";
import { addJob } from "../queues";
import { sequences } from "~/server/db/schema";
import { eq } from "drizzle-orm";
import { withRetry } from "~/server/db/utils";
import { createDb } from "~/server/db/utils";
interface SequenceProcessingJob {
  sequenceId: string;
  bookId: string;
  content: string;
}

export const sequenceProcessingWorker = new Worker<SequenceProcessingJob>(
  QUEUE_NAMES.SEQUENCE_PROCESSING,
  async (job) => {
    const { sequenceId, bookId, content } = job.data;
    const db = createDb();

    console.log(`Starting sequence processing for ${sequenceId}`);

    try {
      // Set initial status with retry
      await withRetry(() => 
        db.update(sequences)
          .set({ status: 'processing' })
          .where(eq(sequences.id, sequenceId))
      );

      // Queue both jobs but don't mark as complete yet
      await Promise.all([
        addJob({
          type: 'audio-generation',
          data: { sequenceId, text: content },
        }),
        addJob({
          type: 'scene-analysis',
          data: { sequenceId, content, bookId },
        }),
      ]);

      console.log(`Successfully queued processing jobs for sequence ${sequenceId}`);
    } catch (error) {
      console.error(`Error processing sequence ${sequenceId}:`, error);
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