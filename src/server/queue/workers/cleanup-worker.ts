import { Worker } from "bullmq";
import { queueOptions, QUEUE_NAMES } from "../config";
import { createDb, closeDb } from "~/server/db/utils";
import { sequences, sequenceMedia, sequenceMetadata } from "~/server/db/schema";
import { lt, and, eq, inArray } from "drizzle-orm";
import { withRetry } from "~/server/db/utils";

interface CleanupJob {
  type: 'cleanup';
}

export const cleanupWorker = new Worker<CleanupJob>(
  QUEUE_NAMES.CLEANUP,
  async (job) => {
    console.log('Cleanup job started', job.id);
    const db = createDb();
    
    try {
      // Delete media and metadata for failed sequences older than 24 hours
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      
      await withRetry(() => 
        db.transaction(async (tx) => {
          // Get IDs of failed sequences older than 24 hours
          const failedSequences = await tx
            .select({ id: sequences.id })
            .from(sequences)
            .where(
              and(
                eq(sequences.status, 'failed'),
                lt(sequences.updatedAt, oneDayAgo)
              )
            );

          const failedSequenceIds = failedSequences.map(seq => seq.id);

          if (failedSequenceIds.length > 0) {
            // Delete associated media for failed sequences
            await tx.delete(sequenceMedia)
              .where(
                and(
                  inArray(sequenceMedia.sequenceId, failedSequenceIds),
                  lt(sequenceMedia.generatedAt, oneDayAgo)
                )
              );
              
            // Delete associated metadata for failed sequences  
            await tx.delete(sequenceMetadata)
              .where(
                and(
                  inArray(sequenceMetadata.sequenceId, failedSequenceIds),
                  lt(sequenceMetadata.createdAt, oneDayAgo)
                )
              );
              
            // Delete the failed sequences themselves
            await tx.delete(sequences)
              .where(
                and(
                  inArray(sequences.id, failedSequenceIds),
                  eq(sequences.status, 'failed'),
                  lt(sequences.updatedAt, oneDayAgo)
                )
              );
          }
        })
      );
      
      console.log('Cleanup completed successfully');
      return { message: 'Cleanup completed' };
    } catch (error) {
      console.error('Cleanup job failed:', error);
      throw error;
    } finally {
      await closeDb(db);
    }
  },
  queueOptions
);
