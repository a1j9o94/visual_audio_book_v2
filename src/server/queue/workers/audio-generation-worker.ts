import { Worker } from "bullmq";
import { queueOptions, QUEUE_NAMES } from "../config";
import { OpenAI, APIError } from 'openai';
import { getMediaStorage } from "~/server/storage";
import { sequences } from "~/server/db/schema";
import { eq } from "drizzle-orm";
import { createDb } from "~/server/db/utils";
import { updateSequenceStatus } from "~/server/queue/workers/sequence-status-manager";

const openai = new OpenAI();

interface AudioGenerationJob {
  sequenceId: string;
  text: string;
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
    const { sequenceId, text } = job.data;
    
    try {
      const db = createDb();

      // Get the sequence to find its book ID
      const sequence = await db.query.sequences.findFirst({
        where: eq(sequences.id, sequenceId),
        columns: { bookId: true }
      });

      if (!sequence?.bookId) {
        throw new Error(`No book ID found for sequence ${sequenceId}`);
      }

      // Generate the audio using OpenAI
      console.log("Generating audio for sequence", sequenceId);
      console.log(`Creating speech for sequence ${sequenceId}, text length: ${text.length}`);
      const mp3: Response = await createSpeech(text);
      console.log(`Speech generated for sequence ${sequenceId}, converting to buffer`);
      const buffer = Buffer.from(await mp3.arrayBuffer());

      // Save the audio file using the storage system
      const storage = getMediaStorage();
      const audioUrl = await storage.saveAudio(sequence.bookId, sequenceId, buffer);
      console.log(`Audio saved for sequence ${sequenceId}: ${audioUrl}`);

      // Update sequence status
      await updateSequenceStatus(db, sequenceId, 'audio-complete');

      // Check if image is also complete
      const updatedSequence = await db.query.sequences.findFirst({
        where: eq(sequences.id, sequenceId)
      });

      if (updatedSequence?.status === 'image-complete') {
        await updateSequenceStatus(db, sequenceId, 'completed');
      }

      return {
        sequenceId,
        audioUrl
      };
    } catch (error: any) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`Error in ${QUEUE_NAMES.AUDIO_GENERATION} for sequence ${sequenceId}:`, {
        error: errorMessage,
        jobData: job.data,
        timestamp: new Date().toISOString()
      });
      
      // Update sequence status to failed
      await updateSequenceStatus(db, sequenceId, 'failed');
      
      throw error;
    }
  },
  queueOptions
); 