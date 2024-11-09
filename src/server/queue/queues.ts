import { Queue } from "bullmq";
import { queueOptions, QUEUE_NAMES } from "./config";
import type { JobData } from "./types";

// Create queues
export const bookProcessingQueue = new Queue<JobData['data']>(
  QUEUE_NAMES.BOOK_PROCESSING,
  queueOptions
);

export const sequenceProcessingQueue = new Queue<JobData['data']>(
  QUEUE_NAMES.SEQUENCE_PROCESSING,
  queueOptions
);

export const audioGenerationQueue = new Queue<JobData['data']>(
  QUEUE_NAMES.AUDIO_GENERATION,
  queueOptions
);

export const imageGenerationQueue = new Queue<JobData['data']>(
  QUEUE_NAMES.IMAGE_GENERATION,
  queueOptions
);

export const sceneAnalysisQueue = new Queue<JobData['data']>(
  QUEUE_NAMES.SCENE_ANALYSIS,
  queueOptions
);

export const cleanupQueue = new Queue<JobData['data']>(
  QUEUE_NAMES.CLEANUP,
  queueOptions
);

export const statusCheckQueue = new Queue<JobData['data']>(
  QUEUE_NAMES.STATUS_CHECK,
  queueOptions
);

// Setup repeatable jobs - only for status check
async function setupRepeatableJobs() {
  // Status check job only
  await statusCheckQueue.add(
    'check',
    {
      type: 'status-check',
      timestamp: Date.now()
    },
    {
      repeat: {
        pattern: '0 */6 * * *' // Every 6 hours
      },
      removeOnComplete: true,
      removeOnFail: false,
    }
  );
}

// Helper function to add jobs to queues
export const addJob = async (jobData: JobData) => {
  const queue = {
    'book-processing': bookProcessingQueue,
    'sequence-processing': sequenceProcessingQueue,
    'audio-generation': audioGenerationQueue,
    'image-generation': imageGenerationQueue,
    'scene-analysis': sceneAnalysisQueue,
    'cleanup': cleanupQueue,
    'status-check': statusCheckQueue,
  }[jobData.type];

  if (!queue) {
    throw new Error(`Invalid job type: ${jobData.type}`);
  }

  await queue.add(jobData.type, jobData.data);
};

// Initialize repeatable jobs
setupRepeatableJobs().catch(console.error);