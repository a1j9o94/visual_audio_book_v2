import "dotenv/config";
import { Worker } from "bullmq";
import { queueOptions, QUEUE_NAMES } from "../config";
import { sequences, sequenceMedia, books } from "~/server/db/schema";
import { eq, sql } from "drizzle-orm";
import axios from "axios";
import { getMediaStorage } from "~/server/storage";
import FormData from "form-data";
import { getDb, closeDb } from "~/server/db/utils";
import { withRetry } from "~/server/db/utils";

interface ImageGenerationJob {
  sequenceId: string;
  sceneDescription: string;
  sequenceNumber: number;
  totalSequences: number;
}

async function generateImage(prompt: string, retryCount = 0): Promise<Buffer> {
  try {
    console.log(`[Image Generation] Attempting to generate image`);
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
    const db = getDb();
    
    console.log(`[Image Worker] Starting job for sequence ${sequenceId}:`, {
      sequenceNumber,
      totalSequences,
      descriptionLength: sceneDescription.length
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

      // Generate the image
      console.log(`[Image Worker ${sequenceNumber}/${totalSequences}] Generating image from description`);
      const imageBuffer = await generateImage(sceneDescription);
      console.log(`[Image Worker ${sequenceNumber}/${totalSequences}] Image generated, buffer size: ${imageBuffer.length}`);

      // Initialize storage with error handling
      console.log(`[Image Worker ${sequenceNumber}/${totalSequences}] Initializing storage`);
      const storage = getMediaStorage();

      // Save the image file with retries and detailed logging
      let imageUrl: URL | undefined;
      let retryCount = 0;
      const maxRetries = 3;

      while (!imageUrl && retryCount < maxRetries) {
        try {
          console.log(`[Image Worker ${sequenceNumber}/${totalSequences}] Attempting to save image (attempt ${retryCount + 1}/${maxRetries})`);
          imageUrl = await storage.saveImage(sequence.bookId, sequenceId, imageBuffer);
          console.log(`[Image Worker ${sequenceNumber}/${totalSequences}] Image saved successfully`);
        } catch (error) {
          retryCount++;
          console.error(`[Image Worker ${sequenceNumber}/${totalSequences}] Save attempt ${retryCount} failed:`, {
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

      if (!imageUrl) {
        throw new Error('Failed to save image after all retries');
      }

      // Update database with detailed logging
      console.log(`[Image Worker ${sequenceNumber}/${totalSequences}] Successfully added image to database`);

      // Update sequence status
      console.log(`[Image Worker ${sequenceNumber}/${totalSequences}] Updating sequence status`);
      await withRetry(() =>
        db.update(sequences)
          .set({ status: 'image-complete' })
          .where(eq(sequences.id, sequenceId))
      );

      // Check completion status
      const media = await withRetry(() => 
        db.query.sequenceMedia.findFirst({
          where: eq(sequenceMedia.sequenceId, sequenceId)
        })
      );

      if (media?.audioUrl && media?.imageUrl) {
        console.log(`[Image Worker ${sequenceNumber}/${totalSequences}] Sequence complete`);
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

      return { sequenceId, imageUrl };
    } catch (error) {
      console.error(`[Image Worker ${sequenceNumber}/${totalSequences}] Fatal error:`, {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        sequenceId,
        phase: 'image-generation-and-storage'
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