import { env } from "~/env";
import IORedis from "ioredis";

export const connection = new IORedis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
});

export const queueOptions = {
  connection,
  defaultJobOptions: {
    removeOnComplete: true,
    removeOnFail: false,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
  },
};

// Queue names
export const QUEUE_NAMES = {
  BOOK_PROCESSING: 'book-processing',
  SEQUENCE_PROCESSING: 'sequence-processing',
  AUDIO_GENERATION: 'audio-generation',
  IMAGE_GENERATION: 'image-generation',
  SCENE_ANALYSIS: 'scene-analysis',
  CLEANUP: 'cleanup',
  STATUS_CHECK: 'status-check',
} as const;

export type QueueName = typeof QUEUE_NAMES[keyof typeof QUEUE_NAMES];

// Repeat patterns for scheduled jobs
export const repeatableJobOptions = {
  // Example for cleanup job that runs every day at midnight
  cleanupJob: {
    pattern: '0 0 * * *', // Cron pattern: every day at midnight
    jobName: 'cleanup',
    options: {
      removeOnComplete: true,
      removeOnFail: false,
    }
  },
  // Example for status check job that runs every hour
  statusCheck: {
    pattern: '0 * * * *', // Cron pattern: every hour
    jobName: 'status-check',
    options: {
      removeOnComplete: true,
      removeOnFail: false,
    }
  }
};