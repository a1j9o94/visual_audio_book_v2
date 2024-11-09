import { Worker } from "bullmq";
import { queueOptions, QUEUE_NAMES } from "../config";
import { createDb, closeDb } from "~/server/db/utils";
import { sequences } from "~/server/db/schema";
import { eq, and, lt } from "drizzle-orm";
import { withRetry } from "~/server/db/utils";

interface StatusCheckJob {
  type: 'status-check';
}

export const statusCheckWorker = new Worker<StatusCheckJob>(
  QUEUE_NAMES.STATUS_CHECK,
  async (job) => {
    console.log('Status check job started', job.id);
    const db = createDb();
    
    try {
      // Find stuck sequences (in processing state for more than 15 minutes)
      const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
      
      const stuckSequences = await withRetry(() => 
        db.query.sequences.findMany({
          where: and(
            eq(sequences.status, 'processing'),
            lt(sequences.updatedAt, fifteenMinutesAgo)
          ),
          columns: { 
            id: true, 
            updatedAt: true,
            sequenceNumber: true 
          }
        })
      );
      
      console.log(`Found ${stuckSequences.length} stuck sequences`);
      
      // Update stuck sequences in a single transaction
      if (stuckSequences.length > 0) {
        await withRetry(() => 
          db.transaction(async (tx) => {
            for (const sequence of stuckSequences) {
              await tx.update(sequences)
                .set({ status: 'failed' })
                .where(eq(sequences.id, sequence.id));
                
              console.log(`Marked stuck sequence ${sequence.id} (${sequence.sequenceNumber}) as failed`);
            }
          })
        );
      }
      
      console.log('Status check completed successfully');
      return { checkedSequences: stuckSequences.length };
    } catch (error) {
      console.error('Status check job failed:', error);
      throw error;
    } finally {
      await closeDb(db);
    }
  },
  queueOptions
);
