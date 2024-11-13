export interface BookProcessingJob {
    bookId: string;
    gutenbergId: string;
    numSequences: number | undefined;
  }
  
  export interface SequenceProcessingJob {
    sequenceId: string;
    bookId: string;
    content: string;
    sequenceNumber: number;
    totalSequences: number;
  }
  
  export interface AudioGenerationJob {
    sequenceId: string;
    text: string;
    sequenceNumber: number;
    totalSequences: number;
  }
  
  export interface ImageGenerationJob {
    sequenceId: string;
    sceneDescription: string;
    sequenceNumber: number;
    totalSequences: number;
  }
  
  export interface SceneAnalysisJob {
    sequenceId: string;
    content: string;
    bookId: string;
    sequenceNumber: number;
    totalSequences: number;
  }
  
  export interface CleanupJob {
    type: 'cleanup';
  }
  
  export interface StatusCheckJob {
    type: 'status-check';
    timestamp: number;
  }
  
  export interface ProgressUpdateJob {
    userId: string;
    sequenceId: string;
    bookId: string;
    timeSpent: number;
    completed: boolean;
  }
  
  export type JobData =
    | { type: 'book-processing'; data: BookProcessingJob }
    | { type: 'sequence-processing'; data: SequenceProcessingJob }
    | { type: 'audio-generation'; data: AudioGenerationJob }
    | { type: 'image-generation'; data: ImageGenerationJob }
    | { type: 'scene-analysis'; data: SceneAnalysisJob }
    | { type: 'cleanup'; data: CleanupJob }
    | { type: 'status-check'; data: StatusCheckJob }
    | { type: 'progress-update'; data: ProgressUpdateJob };