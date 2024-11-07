import { sequences } from "~/server/db/schema";
import { eq } from "drizzle-orm";
import { withRetry } from "~/server/db/utils";
import type { DrizzleClient } from "~/server/db/utils";

export type SequenceStatus = 
  | 'pending'
  | 'processing'
  | 'processing-image'
  | 'processing-audio'
  | 'audio-complete'
  | 'image-complete'
  | 'completed'
  | 'failed';

export async function updateSequenceStatus(
  db: DrizzleClient,
  sequenceId: string, 
  newStatus: SequenceStatus
): Promise<void> {

  console.log(`Updating sequence ${sequenceId} to ${newStatus}`);
  // Do the update in a single operation to avoid deadlocks
  await withRetry(async () => {
    if (newStatus === 'audio-complete' || newStatus === 'image-complete') {
      console.log(`Updating sequence ${sequenceId} to ${newStatus} with transaction`);
        // Use a transaction to ensure atomicity
      await db.transaction(async (tx) => {
        const [sequence] = await tx
          .update(sequences)
          .set({ status: newStatus })
          .where(eq(sequences.id, sequenceId))
          .returning();

        // If both audio and image are complete, update to completed
        if (sequence && (
          (newStatus === 'audio-complete' && sequence.status === 'image-complete') ||
          (newStatus === 'image-complete' && sequence.status === 'audio-complete')
        )) {
          await tx
            .update(sequences)
            .set({ status: 'completed' })
            .where(eq(sequences.id, sequenceId));
        }
      });
    } else {
      // For other statuses, just do a simple update
      console.log(`Updating sequence ${sequenceId} to ${newStatus} without transaction`);
      await db
        .update(sequences)
        .set({ status: newStatus })
        .where(eq(sequences.id, sequenceId));
    }
  });
}
