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
import { getMediaStorage } from '~/server/storage';

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

let isShuttingDown = false;

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
  
  if (isShuttingDown) {
    console.log('Shutdown already in progress...');
    return;
  }
  
  isShuttingDown = true;
  
  try {
    // Set a timeout for the shutdown process
    const shutdownTimeout = setTimeout(() => {
      console.error('Shutdown timeout reached, forcing exit');
      process.exit(1);
    }, 30000); // Increased to 30 seconds
    
    // Close all workers
    await Promise.all(workers.map(async (worker) => {
      console.log(`Closing worker: ${worker.name}`);
      try {
        await worker.close();
        console.log(`Worker ${worker.name} closed successfully`);
      } catch (error) {
        console.error(`Error closing worker ${worker.name}:`, error);
      }
    }));
    
    clearTimeout(shutdownTimeout);
    console.log('All workers closed successfully');
    
    // Give some time for logs to flush
    setTimeout(() => {
      console.log('Exiting process...');
      process.exit(0);
    }, 1000);
  } catch (error) {
    console.error('Error during shutdown:', error);
    process.exit(1);
  }
};

// Handle various shutdown signals
process.on('SIGTERM', () => {
  console.log('Received SIGTERM signal');
  void shutdown('SIGTERM');
});

process.on('SIGINT', () => {
  console.log('Received SIGINT signal');
  void shutdown('SIGINT');
});

process.on('SIGHUP', () => {
  console.log('Received SIGHUP signal');
  void shutdown('SIGHUP');
});

// Add process error handlers
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  void shutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  void shutdown('unhandledRejection');
});

// Add a keep-alive mechanism that checks worker health
const healthCheck = setInterval(() => {
  if (isShuttingDown) {
    console.log('Shutdown in progress, skipping health check');
    return;
  }
  
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] Worker heartbeat - workers: ${workers.length}`);
  
  // Check if workers are still running
  workers.forEach(worker => {
    //only log paused workers
    if (worker.isPaused()) {
      console.log(`Worker ${worker.name} status: paused`);
    }
  });
}, 30000);

// Ensure the interval is cleared on shutdown
process.on('exit', () => {
  clearInterval(healthCheck);
  console.log('Process exit handler called');
});

console.log('Workers started and ready to process jobs');

// Add more detailed UploadThing verification
async function verifyUploadThingConfig() {
  console.log('Verifying UploadThing configuration');
  
  if (!process.env.UPLOADTHING_TOKEN) {
    throw new Error('UPLOADTHING_TOKEN is required but not set');
  }

  try {
    const utapi = new UTApi({
      token: process.env.UPLOADTHING_TOKEN,
      fetch: fetch,
    });
    console.log('UploadThing API initialized', utapi);

    // Log configuration details
    console.log('UploadThing configuration:', {
      hasToken: !!process.env.UPLOADTHING_TOKEN,
      tokenLength: process.env.UPLOADTHING_TOKEN.length,
      environment: process.env.NODE_ENV
    });

  } catch (error) {
    console.error('UploadThing verification failed:', error);
    throw error;
  }
}

// Add to startup sequence
console.log('Worker starting with configuration:', {
  environment: process.env.NODE_ENV,
  hasUploadThingToken: !!process.env.UPLOADTHING_TOKEN,
  hasRedisUrl: !!process.env.REDIS_URL,
  hasDatabaseUrl: !!process.env.DATABASE_URL
});

await verifyUploadThingConfig();

// Verify storage initialization
try {
  const storage = getMediaStorage();
  console.log('Storage initialized successfully', storage);
} catch (error) {
  console.error('Failed to initialize storage:', error);
  process.exit(1);
}