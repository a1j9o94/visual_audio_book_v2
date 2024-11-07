import { Worker } from "bullmq";
import { queueOptions, QUEUE_NAMES } from "../config";
import { OpenAI, APIError } from 'openai';
import { getMediaStorage } from "~/server/storage";
import { sequences, sequenceMedia } from "~/server/db/schema";
import { eq } from "drizzle-orm";
import { createDb, closeDb } from "~/server/db/utils";
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
    return await openai.audio.speech.create({
      model: "tts-1",
      voice: "alloy",
      input: text,
    });
  } catch (error) {
    if (error instanceof APIError && error.status === 429 && retryCount < 2) {
      console.log(`Rate limit reached, retrying (attempt ${retryCount + 2}/3)...`);
      await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
      return createSpeech(text, retryCount + 1);
    }
    throw error;
  }
}

export const audioGenerationWorker = new Worker<AudioGenerationJob>(
  QUEUE_NAMES.AUDIO_GENERATION,
  async (job) => {
    const { sequenceId, text, sequenceNumber, totalSequences } = job.data;
    const db = createDb();
    
    try {
      // Get the sequence to find its book ID
      const sequence = await db.query.sequences.findFirst({
        where: eq(sequences.id, sequenceId),
        columns: { bookId: true }
      });

      if (!sequence?.bookId) {
        throw new Error(`No book ID found for sequence ${sequenceId}`);
      }

      // Generate the audio using OpenAI
      console.log(`[Sequence ${sequenceNumber}/${totalSequences}] Generating audio`);
      console.log(`Creating speech for sequence ${sequenceId}, text length: ${text.length}`);
      const mp3: Response = await createSpeech(text);
      console.log(`[Sequence ${sequenceNumber}/${totalSequences}] Speech generated, converting to buffer`);
      const buffer = Buffer.from(await mp3.arrayBuffer());

      // Save the audio file using the storage system
      const storage = getMediaStorage();
      const audioUrl = await storage.saveAudio(sequence.bookId, sequenceId, buffer);
      console.log(`[Sequence ${sequenceNumber}/${totalSequences}] Audio saved: ${audioUrl}`);

      // Update sequence media with audio URL
      await withRetry(() => 
        db.insert(sequenceMedia)
          .values({
            sequenceId,
            audioUrl,
            generatedAt: new Date()
          })
          .onConflictDoUpdate({
            target: sequenceMedia.sequenceId,
            set: {
              audioUrl,
              generatedAt: new Date()
            }
          })
      );

      // First mark audio as complete
      await withRetry(() => 
        db.update(sequences)
          .set({ status: 'audio-complete' })
          .where(eq(sequences.id, sequenceId))
      );

      // Check if image is also complete by checking sequenceMedia
      const media = await db.query.sequenceMedia.findFirst({
        where: eq(sequenceMedia.sequenceId, sequenceId)
      });

      if (media?.imageUrl) {
        console.log(`[Sequence ${sequenceNumber}/${totalSequences}] Both audio and image complete, marking as completed`);
        await withRetry(() =>
          db.update(sequences)
            .set({ status: 'completed' })
            .where(eq(sequences.id, sequenceId))
        );
      }

      return {
        sequenceId,
        audioUrl
      };
    } catch (error) {
      console.error(`[Sequence ${sequenceNumber}/${totalSequences}] Error:`, error);
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