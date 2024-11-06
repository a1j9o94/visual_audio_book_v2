import { Worker } from "bullmq";
import { queueOptions, QUEUE_NAMES } from "../config";

interface ImageGenerationJob {
  sequenceId: string;
  sceneDescription: string;
}

export const imageGenerationWorker = new Worker<ImageGenerationJob>(
  QUEUE_NAMES.IMAGE_GENERATION,
  async (job) => {
    const { sequenceId, sceneDescription } = job.data;
    // TODO: Implement Stability AI image generation
    console.log("Generating image for sequence", sequenceId);

    return {
      sequenceId,
      sceneDescription
    };
  },
  queueOptions
); 