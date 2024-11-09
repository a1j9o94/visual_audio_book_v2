import "dotenv/config";
import { Worker } from "bullmq";
import { queueOptions, QUEUE_NAMES } from "../config";
import { sequences, sequenceMedia } from "~/server/db/schema";
import { eq } from "drizzle-orm";
import axios from "axios";
import { getMediaStorage } from "~/server/storage";
import FormData from "form-data";
import { createDb, closeDb } from "~/server/db/utils";
import { withRetry } from "~/server/db/utils";

interface ImageGenerationJob {
  sequenceId: string;
  sceneDescription: string;
  sequenceNumber: number;
  totalSequences: number;
}

async function generateImage(prompt: string, retryCount = 0): Promise<Buffer> {
  try {
    console.log(`[Image Generation] Attempting to generate image with prompt: ${prompt.substring(0, 100)}...`);
    const route = process.env.STABILITY_AI_API_URL;
    
    const payload = {
      prompt,
      output_format: "png"
    };

    const response = await axios.postForm(
      route!,
      axios.toFormData(payload, new FormData()),
      {
        headers: {
          'Accept': 'image/*',
          'Authorization': `Bearer ${process.env.STABILITY_API_KEY}`,
        },
        responseType: 'arraybuffer',
        validateStatus: undefined,
      }
    );
    
    if (response.status !== 200) {
      if (!response.data) {
        throw new Error(`API returned status ${response.status}: No data`);
      }
      const errorText = Buffer.from(response.data as ArrayBuffer).toString();
      throw new Error(`API returned status ${response.status}: ${errorText}`);
    }

    console.log('[Image Generation] API response status:', response.status);
    return Buffer.from(response.data as ArrayBuffer);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';

    //check for content moderation error and if so, don't retry
    if (message.includes('Content moderation')) {
      throw error;
    }

    if(message.includes('English is the only supported')){
      throw error;
    }

    if (retryCount < 2) {
      console.log(`[Image Generation] API call failed, retrying (attempt ${retryCount + 2}/3)...`);
      await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
      return generateImage(prompt, retryCount + 1);
    }
    throw error;
  }
}

export const imageGenerationWorker = new Worker<ImageGenerationJob>(
  QUEUE_NAMES.IMAGE_GENERATION,
  async (job) => {
    const { sequenceId, sceneDescription, sequenceNumber, totalSequences } = job.data;
    const db = createDb();
    
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

      // Generate the image
      console.log(`[Sequence ${sequenceNumber}/${totalSequences}] Starting image generation`);
      try {
        const imageBuffer = await generateImage(sceneDescription);
        console.log(`[Sequence ${sequenceNumber}/${totalSequences}] Image generated, buffer size: ${imageBuffer.length}`);

        // Initialize storage with error handling
        console.log('[Storage] Initializing media storage');
        const storage = getMediaStorage();

        // Save the image file with retries
        let imageUrl: string | undefined;
        await withRetry(async () => {
          try {
            if (!sequence.bookId) {
              throw new Error(`No book ID found for sequence ${sequenceId}`);
            }
            imageUrl = await storage.saveImage(sequence.bookId, sequenceId, imageBuffer);
            console.log(`[Sequence ${sequenceNumber}/${totalSequences}] Image saved successfully: ${imageUrl}`);
          } catch (error) {
            console.error('[Storage] Failed to save image:', {
              error: error instanceof Error ? error.message : 'Unknown error',
              sequenceId,
              attempt: 'Retry will be attempted'
            });
            throw error; // Trigger retry
          }
        }, 3); // Allow up to 3 retries

        if (!imageUrl) {
          throw new Error('Failed to save image after retries');
        }

        // Save the image URL
        await withRetry(() =>
          db.insert(sequenceMedia)
            .values({
              sequenceId,
              imageUrl,
              generatedAt: new Date()
            })
            .onConflictDoUpdate({
              target: sequenceMedia.sequenceId,
              set: {
                imageUrl,
                generatedAt: new Date()
              }
        }));

        // First mark image as complete
        await withRetry(() =>
          db.update(sequences)
            .set({ status: 'image-complete' })
            .where(eq(sequences.id, sequenceId))
        );

        // Check if audio is also complete by checking sequenceMedia
        const media = await withRetry(() => 
          db.query.sequenceMedia.findFirst({
            where: eq(sequenceMedia.sequenceId, sequenceId)
          })
        );

        if (media?.audioUrl) {
          console.log(`[Sequence ${sequenceNumber}/${totalSequences}] Both audio and image complete, marking as completed`);
          await withRetry(() =>
            db.update(sequences)
              .set({ status: 'completed' })
              .where(eq(sequences.id, sequenceId))
          );
        }

        return { sequenceId, imageUrl };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error(`[Sequence ${sequenceNumber}/${totalSequences}] Error:`, {
          message,
          stack: error instanceof Error ? error.stack : undefined,
          phase: 'image-generation-or-storage'
        });
        
        await withRetry(() =>
          db.update(sequences)
            .set({ status: 'failed' })
            .where(eq(sequences.id, sequenceId))
        );
        
        throw error;
      }
    } finally {
      await closeDb(db);
    }
  },
  queueOptions
); 