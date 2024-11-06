import { Worker } from "bullmq";
import { queueOptions, QUEUE_NAMES } from "../config";
import { addJob } from "../queues";

interface SceneAnalysisJob {
  sequenceId: string;
  content: string;
  bookId: string;
}

export const sceneAnalysisWorker = new Worker<SceneAnalysisJob>(
  QUEUE_NAMES.SCENE_ANALYSIS,
  async (job) => {
    const { sequenceId, content } = job.data;
    // TODO: Implement Claude scene analysis
    
    // Placeholder: Queue image generation with stub description
    await addJob({
      type: 'image-generation',
      data: {
        sequenceId,
        sceneDescription: 'Generated scene description',
      },
    });
  },
  queueOptions
); 