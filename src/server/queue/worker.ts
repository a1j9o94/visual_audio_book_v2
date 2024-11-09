import 'dotenv/config';
import { UTApi } from "uploadthing/server";
import {
  bookProcessingWorker,
  sequenceProcessingWorker,
  audioGenerationWorker,
  imageGenerationWorker,
  sceneAnalysisWorker,
  cleanupWorker,
  statusCheckWorker,
} from './workers';

// Initialize UploadThing API globally for workers
const utapi = new UTApi({
  token: process.env.UPLOADTHING_TOKEN,
  fetch: fetch,
});

// Verify UploadThing configuration
if (!process.env.UPLOADTHING_TOKEN) {
  throw new Error('UPLOADTHING_TOKEN is required but not set');
}

console.log('UploadThing configuration verified', utapi);

// Error handling for workers
const workers = [
  bookProcessingWorker,
  sequenceProcessingWorker,
  audioGenerationWorker,
  imageGenerationWorker,
  sceneAnalysisWorker,
  cleanupWorker,
  statusCheckWorker,
];

workers.forEach((worker) => {
  worker.on('failed', (job, err) => {
    console.error(`Job ${job?.id} in ${worker.name} failed:`, err);
  });

  worker.on('completed', (job) => {
    console.log(`Job ${job.id} in ${worker.name} completed`);
  });
});

// Graceful shutdown
const shutdown = async () => {
  console.log('Shutting down workers...');
  
  await Promise.all(workers.map((worker) => worker.close()));
  
  process.exit(0);
};

process.on('SIGTERM', () => void shutdown());
process.on('SIGINT', () => void shutdown());

console.log('Workers started');