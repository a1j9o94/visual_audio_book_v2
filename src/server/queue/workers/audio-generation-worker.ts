import { Worker } from "bullmq";
import { queueOptions, QUEUE_NAMES } from "../config";
import { OpenAI, APIError } from 'openai';
import { getMediaStorage } from "~/server/storage";
import { sequences, sequenceMedia, books } from "~/server/db/schema";
import { eq, sql } from "drizzle-orm";
import { getDb, closeDb } from "~/server/db/utils";
import { withRetry } from "~/server/db/utils";

const openai = new OpenAI();

interface AudioGenerationJob {
  sequenceId: string;
  text: string;
  sequenceNumber: number;
  totalSequences: number;
}

async function createSpeech(text: string, retryCount = 0): Promise<Response> {
  try {
    console.log(`[Audio Generation] Creating speech for text:`, {
      textLength: text.length,
      attempt: retryCount + 1,
      maxAttempts: 3
    });

    return await openai.audio.speech.create({
      model: "tts-1",
      voice: "alloy",
      input: text,
    });
  } catch (error) {
    if (error instanceof APIError && error.status === 429 && retryCount < 2) {
      console.log(`[Audio Generation] Rate limit reached:`, {
        attempt: retryCount + 1,
        nextAttemptDelay: `${(retryCount + 1) * 1000}ms`,
        errorStatus: error.status
      });
      await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
      return createSpeech(text, retryCount + 1);
    }
    console.error('[Audio Generation] Speech creation failed:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      attempt: retryCount + 1
    });
    throw error;
  }
}

export const audioGenerationWorker = new Worker<AudioGenerationJob>(
  QUEUE_NAMES.AUDIO_GENERATION,
  async (job) => {
    const { sequenceId, text, sequenceNumber, totalSequences } = job.data;
    const db = getDb();
    
    console.log(`[Audio Worker] Starting job for sequence ${sequenceId}:`, {
      sequenceNumber,
      totalSequences,
      textLength: text.length
    });
    
    try {
      // Get the sequence to find its book ID
      const sequence = await withRetry(() => 
        db.query.sequences.findFirst({
          where: eq(sequences.id, sequenceId),
          columns: { bookId: true }
        })
      );

      if (!sequence) {
        throw new Error(`No sequence found for ${sequenceId}`);
      }

      if (!sequence.bookId) {
        throw new Error(`No book ID found for sequence ${sequenceId}`);
      }

      // Generate the audio using OpenAI
      console.log(`[Audio Worker ${sequenceNumber}/${totalSequences}] Generating audio`);
      const mp3: Response = await createSpeech(text);
      console.log(`[Audio Worker ${sequenceNumber}/${totalSequences}] Speech generated, converting to buffer`);
      const buffer = Buffer.from(await mp3.arrayBuffer());
      console.log(`[Audio Worker ${sequenceNumber}/${totalSequences}] Buffer created, size: ${buffer.length}`);

      // Initialize storage with error handling
      console.log(`[Audio Worker ${sequenceNumber}/${totalSequences}] Initializing storage`);
      const storage = getMediaStorage();

      // Save the audio file with retries and detailed logging
      let audioUrl: URL | undefined;
      let retryCount = 0;
      const maxRetries = 3;

      while (!audioUrl && retryCount < maxRetries) {
        try {
          console.log(`[Audio Worker ${sequenceNumber}/${totalSequences}] Attempting to save audio (attempt ${retryCount + 1}/${maxRetries})`);
          audioUrl = await storage.saveAudio(sequence.bookId, sequenceId, buffer);
          console.log(`[Audio Worker ${sequenceNumber}/${totalSequences}] Audio saved successfully`);
        } catch (error) {
          retryCount++;
          console.error(`[Audio Worker ${sequenceNumber}/${totalSequences}] Save attempt ${retryCount} failed:`, {
            error: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined
          });
          
          if (retryCount === maxRetries) {
            throw error;
          }
          // Wait before retrying
          await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
        }
      }

      if (!audioUrl) {
        throw new Error('Failed to save audio after all retries');
      }

      console.log(`[Audio Worker ${sequenceNumber}/${totalSequences}] Audio saved successfully`);

      // Update sequence status
      console.log(`[Audio Worker ${sequenceNumber}/${totalSequences}] Updating sequence status`);
      await withRetry(() =>
        db.update(sequences)
          .set({ status: 'audio-complete' })
          .where(eq(sequences.id, sequenceId))
      );

      // Check completion status
      const media = await withRetry(() => 
        db.query.sequenceMedia.findFirst({
          where: eq(sequenceMedia.sequenceId, sequenceId)
        })
      );

      if (media?.audioUrl && media?.imageUrl) {
        console.log(`[Audio Worker ${sequenceNumber}/${totalSequences}] Sequence complete`);
        await withRetry(() => db.transaction(async (tx) => {
          await tx.update(sequences)
            .set({ status: 'completed' })
            .where(eq(sequences.id, sequenceId));
          
          await tx.update(books)
            .set({ 
              completedSequenceCount: sql`${books.completedSequenceCount} + 1` 
            })
            .where(eq(books.id, sequence.bookId ?? ''));
        }));
      }

      return { sequenceId, audioUrl };
    } catch (error) {
      console.error(`[Audio Worker ${sequenceNumber}/${totalSequences}] Fatal error:`, {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        sequenceId,
        phase: 'audio-generation-and-storage'
      });
      
      await withRetry(() =>
        db.update(sequences)
          .set({ status: 'failed' })
          .where(eq(sequences.id, sequenceId))
      );
      
      throw error;
    } finally {
      await closeDb(db);
    }
  },
  queueOptions
); 