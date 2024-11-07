import "dotenv/config";
import { Worker } from "bullmq";
import { queueOptions, QUEUE_NAMES } from "../config";
import { sequences, sequenceMedia } from "~/server/db/schema";
import { eq } from "drizzle-orm";
import axios from "axios";
import { getMediaStorage } from "~/server/storage";
import FormData from "form-data";
import { createDb } from "~/server/db/utils";
import { updateSequenceStatus } from "./sequence-status-manager";

interface ImageGenerationJob {
  sequenceId: string;
  sceneDescription: string;
}

async function generateImage(prompt: string, retryCount = 0): Promise<Buffer> {
  try {
    console.log(`Attempting to generate image with prompt: ${prompt.substring(0, 100)}...`);
    const route = process.env.STABILITY_AI_API_URL;
    console.log(`Using route: ${route}`);
    
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
      const errorText = Buffer.from(response.data).toString();
      throw new Error(`API returned status ${response.status}: ${errorText}`);
    }

    console.log('Image generation API response status:', response.status);
    return Buffer.from(response.data);
  } catch (error) {
    console.error('Image generation error details:', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    if (retryCount < 2) {
      console.log(`API call failed, retrying (attempt ${retryCount + 2}/3)...`);
      await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
      return generateImage(prompt, retryCount + 1);
    }
    throw error;
  }
}

export const imageGenerationWorker = new Worker<ImageGenerationJob>(
  QUEUE_NAMES.IMAGE_GENERATION,
  async (job) => {
    const { sequenceId, sceneDescription } = job.data;
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

      // Generate the image
      console.log(`Starting image generation for sequence ${sequenceId}`);
      const imageBuffer = await generateImage(sceneDescription);

      // After image generation, before saving
      console.log(`Image generated for sequence ${sequenceId}, buffer size: ${imageBuffer.length}`);

      // Save the image file
      const storage = getMediaStorage();
      const imageUrl = await storage.saveImage(sequence.bookId, sequenceId, imageBuffer);

      // Save the image URL in sequenceMedia
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
          })
      );

      // Update sequence status
      await updateSequenceStatus(db, sequenceId, 'image-complete');

      // Check if audio is also complete
      const updatedSequence = await db.query.sequences.findFirst({
        where: eq(sequences.id, sequenceId)
      });

      if (updatedSequence?.status === 'audio-complete') {
        await updateSequenceStatus(db, sequenceId, 'completed');
      }

      console.log(`Image generation for sequence ${sequenceId} completed`);

      return {
        sequenceId,
        imageUrl
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`Error in ${QUEUE_NAMES.IMAGE_GENERATION} for sequence ${sequenceId}:`, {
        error: errorMessage,
        jobData: job.data,
        timestamp: new Date().toISOString()
      });
      
      // Update sequence status to failed
      await updateSequenceStatus(db, sequenceId, 'failed');
      
      throw error;
    } finally {
      await closeDb(db);
    }
  },
  queueOptions
); 