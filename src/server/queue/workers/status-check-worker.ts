import { Worker } from "bullmq";
import { queueOptions, QUEUE_NAMES } from "../config";
import { createDb, closeDb } from "~/server/db/utils";
import { sequences } from "~/server/db/schema";
import { eq } from "drizzle-orm";

interface StatusCheckJob {
  type: 'status-check';
}

export const statusCheckWorker = new Worker<StatusCheckJob>(
  QUEUE_NAMES.BOOK_PROCESSING,
  async (job) => {
    console.log('Status check job started', job.id);
    const db = createDb();
    
    try {
      // Find stuck sequences (in processing state for more than 15 minutes)
      const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
      
      const stuckSequences = await db.query.sequences.findMany({
        where: eq(sequences.status, 'processing'),
        columns: { id: true, createdAt: true }
      });
      
      for (const sequence of stuckSequences) {
        if (!sequence.createdAt) {
          console.error(`Sequence ${sequence.id} has no createdAt timestamp`);
          continue;
        }
        
        if (sequence.createdAt < fifteenMinutesAgo) {
          // Mark stuck sequence as failed
          await db.update(sequences)
            .set({ status: 'failed' })
            .where(eq(sequences.id, sequence.id));
            
          console.log(`Marked stuck sequence ${sequence.id} as failed`);
        }
      }
      
      console.log('Status check completed successfully');
    } catch (error) {
      console.error('Status check job failed:', error);
      throw error;
    } finally {
      await closeDb(db);
    }
  },
  queueOptions
);
