import 'dotenv/config';
import {
  bookProcessingWorker,
  sequenceProcessingWorker,
  audioGenerationWorker,
  imageGenerationWorker,
  sceneAnalysisWorker,
} from './workers';

// Error handling for workers
const workers = [
  bookProcessingWorker,
  sequenceProcessingWorker,
  audioGenerationWorker,
  imageGenerationWorker,
  sceneAnalysisWorker,
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