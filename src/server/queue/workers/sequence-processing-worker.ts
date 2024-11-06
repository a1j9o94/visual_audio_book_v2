import { Worker } from "bullmq";
import { queueOptions, QUEUE_NAMES } from "../config";
import { addJob } from "../queues";

interface SequenceProcessingJob {
  sequenceId: string;
  bookId: string;
  content: string;
}

export const sequenceProcessingWorker = new Worker<SequenceProcessingJob>(
  QUEUE_NAMES.SEQUENCE_PROCESSING,
  async (job) => {
    const { sequenceId, bookId, content } = job.data;

    await Promise.all([
      addJob({
        type: 'audio-generation',
        data: { sequenceId, text: content },
      }),
      addJob({
        type: 'scene-analysis',
        data: { sequenceId, content, bookId },
      }),
    ]);
  },
  queueOptions
); 