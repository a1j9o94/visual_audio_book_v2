import { Worker } from "bullmq";
import { queueOptions, QUEUE_NAMES } from "../config";

interface AudioGenerationJob {
  sequenceId: string;
  text: string;
}

export const audioGenerationWorker = new Worker<AudioGenerationJob>(
  QUEUE_NAMES.AUDIO_GENERATION,
  async (job) => {
    const { sequenceId, text } = job.data;
    // TODO: Implement OpenAI TTS logic in the meantime echo the text
    console.log("Getting audio for sequence", sequenceId);
    return {
      sequenceId,
      text
    };
  },
  queueOptions
); 