export interface BookProcessingJob {
    bookId: string;
    gutenbergId: string;
  }
  
  export interface SequenceProcessingJob {
    sequenceId: string;
    bookId: string;
    content: string;
  }
  
  export interface AudioGenerationJob {
    sequenceId: string;
    text: string;
  }
  
  export interface ImageGenerationJob {
    sequenceId: string;
    sceneDescription: string;
  }
  
  export interface SceneAnalysisJob {
    sequenceId: string;
    content: string;
    bookId: string;
  }
  
  export type JobData =
    | { type: 'book-processing'; data: BookProcessingJob }
    | { type: 'sequence-processing'; data: SequenceProcessingJob }
    | { type: 'audio-generation'; data: AudioGenerationJob }
    | { type: 'image-generation'; data: ImageGenerationJob }
    | { type: 'scene-analysis'; data: SceneAnalysisJob };