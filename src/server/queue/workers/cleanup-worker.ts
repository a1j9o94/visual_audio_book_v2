import { Worker } from "bullmq";
import { queueOptions, QUEUE_NAMES } from "../config";
import { createDb, closeDb } from "~/server/db/utils";
import { sequences, sequenceMedia, sequenceMetadata } from "~/server/db/schema";
import { lt } from "drizzle-orm";

interface CleanupJob {
  type: 'cleanup';
}

export const cleanupWorker = new Worker<CleanupJob>(
  QUEUE_NAMES.BOOK_PROCESSING,
  async (job) => {
    console.log('Cleanup job started', job.id);
    const db = createDb();
    
    try {
      // Delete media and metadata for failed sequences older than 24 hours
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      
      await db.transaction(async (tx) => {
        // Delete associated media
        await tx.delete(sequenceMedia)
          .where(lt(sequenceMedia.generatedAt, oneDayAgo));
          
        // Delete associated metadata
        await tx.delete(sequenceMetadata)
          .where(lt(sequenceMetadata.createdAt, oneDayAgo));
          
        // Delete failed sequences
        await tx.delete(sequences)
          .where(lt(sequences.updatedAt, oneDayAgo));
      });
      
      console.log('Cleanup completed successfully');
    } catch (error) {
      console.error('Cleanup job failed:', error);
      throw error;
    } finally {
      await closeDb(db);
    }
  },
  queueOptions
);
