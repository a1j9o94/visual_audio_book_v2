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

// Initialize and verify UploadThing configuration
const utapi = new UTApi({
  token: process.env.UPLOADTHING_TOKEN,
  fetch: fetch,
});

// Verify UploadThing configuration
if (!process.env.UPLOADTHING_TOKEN) {
  throw new Error('UPLOADTHING_TOKEN is required but not set');
}

console.log('UploadThing configuration verified', utapi);

// Initialize workers array
const workers = [
  bookProcessingWorker,
  sequenceProcessingWorker,
  audioGenerationWorker,
  imageGenerationWorker,
  sceneAnalysisWorker,
  cleanupWorker,
  statusCheckWorker,
];

// Add more detailed worker error handling
workers.forEach((worker) => {
  worker.on('failed', (job, err) => {
    console.error(`Job ${job?.id} in ${worker.name} failed:`, err);
  });

  worker.on('completed', (job) => {
    console.log(`Job ${job.id} in ${worker.name} completed`);
  });

  worker.on('error', (err) => {
    console.error(`Worker ${worker.name} encountered an error:`, err);
  });
});

// Modify shutdown handler to be more graceful
const shutdown = async (signal: string) => {
  console.log(`Received ${signal}, starting graceful shutdown...`);
  
  try {
    // Set a timeout for the shutdown process
    const shutdownTimeout = setTimeout(() => {
      console.error('Shutdown timeout reached, forcing exit');
      process.exit(1);
    }, 10000); // 10 second timeout
    
    // Close all workers
    await Promise.all(workers.map(async (worker) => {
      console.log(`Closing worker: ${worker.name}`);
      await worker.close();
    }));
    
    clearTimeout(shutdownTimeout);
    console.log('All workers closed successfully');
    process.exit(0);
  } catch (error) {
    console.error('Error during shutdown:', error);
    process.exit(1);
  }
};

// Handle various shutdown signals
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGHUP', () => void shutdown('SIGHUP'));

// Add process error handlers
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  // Don't exit immediately to allow for cleanup
  setTimeout(() => process.exit(1), 1000);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit immediately to allow for cleanup
  setTimeout(() => process.exit(1), 1000);
});

// Add a keep-alive mechanism
setInterval(() => {
  console.log('Worker heartbeat - still running');
}, 30000);

console.log('Workers started and ready to process jobs');