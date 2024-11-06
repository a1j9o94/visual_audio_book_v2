import { Queue } from "bullmq";
import { queueOptions, QUEUE_NAMES, repeatableJobOptions } from "./config";
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

// Setup repeatable jobs
async function setupRepeatableJobs() {
  // Cleanup job
  await bookProcessingQueue.add(
    repeatableJobOptions.cleanupJob.jobName,
    { type: 'cleanup' },
    {
      repeat: {
        pattern: repeatableJobOptions.cleanupJob.pattern
      },
      ...repeatableJobOptions.cleanupJob.options
    }
  );

  // Status check job
  await bookProcessingQueue.add(
    repeatableJobOptions.statusCheck.jobName,
    { type: 'status-check' },
    {
      repeat: {
        pattern: repeatableJobOptions.statusCheck.pattern
      },
      ...repeatableJobOptions.statusCheck.options
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
  }[jobData.type];

  await queue.add(jobData.type, jobData.data);
};

// Initialize repeatable jobs
setupRepeatableJobs().catch(console.error);