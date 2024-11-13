import { Worker } from 'bullmq';
import { db } from '~/server/db';
import { queueOptions, QUEUE_NAMES } from '../config';
import { userSequenceHistory, userBookProgress } from '~/server/db/schema';
import { and, eq, sql } from 'drizzle-orm';
import { sequences } from '~/server/db/schema';

interface ProgressUpdateJob {
  userId: string;
  sequenceId: string;
  bookId: string;
  timeSpent: number;
  completed: boolean;
}

export const progressUpdateWorker = new Worker<ProgressUpdateJob>(
  QUEUE_NAMES.PROGRESS_UPDATE,
  async (job) => {
    const { userId, sequenceId, bookId, timeSpent, completed } = job.data;

    try {
      await db.transaction(async (tx) => {
        // Ensure userBookProgress record exists
        const progress = await tx.query.userBookProgress.findFirst({
          where: and(
            eq(userBookProgress.userId, userId),
            eq(userBookProgress.bookId, bookId)
          ),
        });

        if (!progress) {
          await tx.insert(userBookProgress).values({
            userId,
            bookId,
            lastSequenceNumber: 0,
            lastReadAt: new Date(),
            totalTimeSpent: 0,
            isComplete: false,
            readingPreferences: {},
            updatedAt: new Date(),
          });
        }

        // Update sequence history
        await tx.insert(userSequenceHistory).values({
          userId,
          sequenceId,
          timeSpent,
          completed,
        });

        // Get sequence number
        const sequence = await tx.query.sequences.findFirst({
          where: eq(sequences.id, sequenceId),
          columns: {
            sequenceNumber: true,
          },
        });

        // Update book progress
        await tx.update(userBookProgress)
          .set({
            totalTimeSpent: sql`${userBookProgress.totalTimeSpent} + ${timeSpent}`,
            lastReadAt: new Date(),
            lastSequenceNumber: sequence?.sequenceNumber ?? 0,
            updatedAt: new Date(),
          })
          .where(and(
            eq(userBookProgress.userId, userId),
            eq(userBookProgress.bookId, bookId)
          ));
      });
    } catch (error) {
      console.error('Error processing progress update:', error);
      throw error;
    }
  },
  queueOptions
); 