import { Worker } from "bullmq";
import { queueOptions, QUEUE_NAMES } from "../config";
import { addJob } from "../queues";
import { sequences, sequenceMetadata } from "~/server/db/schema";
import { eq } from "drizzle-orm";
import { Anthropic } from '@anthropic-ai/sdk';
import { withRetry } from "~/server/db/utils";
import { createDb, closeDb } from "~/server/db/utils";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY ?? '',
});

interface SceneAnalysisJob {
  sequenceId: string;
  content: string;
  bookId: string;
  sequenceNumber: number;
  totalSequences: number;
}

interface SceneAnalysisResult {
  sceneDescription: string;
}

async function analyzeScene(content: string, retryCount = 0): Promise<SceneAnalysisResult> {
  try {
    const msg = await anthropic.messages.create({
      model: "claude-3-sonnet-20240229",
      max_tokens: 1000,
      temperature: 0.7,
      system: "You are a skilled film director and screenwriter. Analyze the scene and provide a concise, vivid description suitable for image generation. Focus on the main visual elements, mood, and setting. Always describe scenes in English, even if the original text is in another language.",
      messages: [
        {
          role: "user",
          content: content
        }
      ]
    });

    if (!msg.content[0]?.text) {
      throw new Error("No scene description returned from Anthropic");
    }

    return {
      sceneDescription: msg.content[0].text,
    };
  } catch (error) {
    if (retryCount < 2) {
      console.log(`API call failed, retrying (attempt ${retryCount + 2}/3)...`);
      await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
      return analyzeScene(content, retryCount + 1);
    }
    
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Unknown error occurred');
  }
}

export const sceneAnalysisWorker = new Worker<SceneAnalysisJob>(
  QUEUE_NAMES.SCENE_ANALYSIS,
  async (job) => {
    const db = createDb();
    
    try {
      // Update status to processing
      await withRetry(() =>
        db.update(sequences)
          .set({ status: 'processing' })
          .where(eq(sequences.id, job.data.sequenceId))
      );

      let sceneDescription = '';

      // Use a transaction for atomic operations
      await db.transaction(async (tx) => {
        // Perform scene analysis
        const analysis = await analyzeScene(job.data.content);
        sceneDescription = analysis.sceneDescription;
        console.log("Scene analysis result:", analysis);

        // Insert metadata
        await tx.insert(sequenceMetadata)
          .values({
            sequenceId: job.data.sequenceId,
            sceneDescription: JSON.stringify({ sceneDescription: analysis.sceneDescription }),
          })
          .onConflictDoUpdate({
            target: sequenceMetadata.sequenceId,
            set: {
              sceneDescription: JSON.stringify({ sceneDescription: analysis.sceneDescription }),
            }
          })
          .execute();
      });

      // Queue image generation outside transaction
      await addJob({
        type: 'image-generation',
        data: {
          sequenceId: job.data.sequenceId,
          sceneDescription,
          sequenceNumber: job.data.sequenceNumber,
          totalSequences: job.data.totalSequences
        },
      });

      // Update to processing-image status
      await withRetry(() =>
        db.update(sequences)
          .set({ status: 'processing-image' })
          .where(eq(sequences.id, job.data.sequenceId))
      );

      return {
        sequenceId: job.data.sequenceId,
        sceneDescription
      };
    } catch (error) {
      // Update failed status directly
      await withRetry(() =>
        db.update(sequences)
          .set({ status: 'failed' })
          .where(eq(sequences.id, job.data.sequenceId))
      );
      
      throw error;
    } finally {
      await closeDb(db);  // Add this to properly close the database connection
    }
  },
  queueOptions
); 