import { Worker } from "bullmq";
import { queueOptions, QUEUE_NAMES } from "../config";
import { addJob } from "../queues";
import { sequences, sequenceMetadata } from "~/server/db/schema";
import { eq } from "drizzle-orm";
import { Anthropic } from '@anthropic-ai/sdk';
import { withRetry } from "~/server/db/utils";
import { createDb, closeDb } from "~/server/db/utils";
import { updateSequenceStatus } from "~/server/queue/workers/sequence-status-manager";
import type { DrizzleClient } from "~/server/db/utils";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY ?? '',
});

interface SceneAnalysisJob {
  sequenceId: string;
  content: string;
  bookId: string;
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
      system: "You are a skilled film director and screenwriter. Analyze the scene and provide a concise, vivid description suitable for image generation. Focus on the main visual elements, mood, and setting.",
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
    
    console.log(`Scene analysis worker received job for sequence ${job.data.sequenceId}`);
    
    try {
      let sceneDescription: string = '';

      // Use a transaction for atomic operations
      await db.transaction(async (tx) => {
        // Update sequence status
        const sequence = await tx.update(sequences)
          .set({ status: 'processing' as const })
          .where(eq(sequences.id, job.data.sequenceId))
          .returning()
          .execute();

        if (!sequence.length) {
          throw new Error(`Sequence ${job.data.sequenceId} not found`);
        }

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

        // Update sequence status using db instead of tx
        await updateSequenceStatus(db, job.data.sequenceId, 'processing-image');
      });

      // Queue image generation outside transaction
      await addJob({
        type: 'image-generation',
        data: {
          sequenceId: job.data.sequenceId,
          sceneDescription,
        },
      });

      return {
        sequenceId: job.data.sequenceId,
        sceneDescription
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`Error in ${QUEUE_NAMES.SCENE_ANALYSIS} for sequence ${job.data.sequenceId}:`, {
        error: errorMessage,
        jobData: job.data,
        timestamp: new Date().toISOString()
      });
      
      await withRetry(() =>
        db.update(sequences)
          .set({ status: 'failed' as const })
          .where(eq(sequences.id, job.data.sequenceId))
      );
      
      throw new Error(errorMessage);
    } finally {
      await closeDb(db);
    }
  },
  queueOptions
); 