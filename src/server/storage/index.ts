// src/server/storage/index.ts
import { db } from "~/server/db";
import { sequenceMedia } from "~/server/db/schema";
import { eq } from "drizzle-orm";

// Media storage interface
interface MediaStorage {
  saveAudio(bookId: string, sequenceId: string, buffer: Buffer): Promise<string>;
  saveImage(bookId: string, sequenceId: string, buffer: Buffer): Promise<string>;
  getAudioUrl(sequenceId: string): Promise<string>;
  getImageUrl(sequenceId: string): Promise<string>;
}

// Database storage implementation
export class DatabaseMediaStorage implements MediaStorage {
  async saveAudio(_bookId: string, sequenceId: string, buffer: Buffer): Promise<string> {
    const base64Data = buffer.toString('base64');
    
    await db.insert(sequenceMedia).values({
      sequenceId,
      audioData: base64Data,
      generatedAt: new Date(),
    }).onConflictDoUpdate({
      target: [sequenceMedia.sequenceId],
      set: {
        audioData: base64Data,
        generatedAt: new Date(),
      }
    });

    return `data:audio/mpeg;base64,${base64Data}`;
  }

  async saveImage(bookId: string, sequenceId: string, buffer: Buffer): Promise<string> {
    const base64Data = buffer.toString('base64');
    
    await db.insert(sequenceMedia).values({
      sequenceId,
      imageData: base64Data,
      generatedAt: new Date(),
    }).onConflictDoUpdate({
      target: [sequenceMedia.sequenceId],
      set: {
        imageData: base64Data,
        generatedAt: new Date(),
      }
    });

    return `data:image/png;base64,${base64Data}`;
  }

  async getAudioUrl(sequenceId: string): Promise<string> {
    const result = await db.query.sequenceMedia.findFirst({
      where: eq(sequenceMedia.sequenceId, sequenceId),
      columns: { audioData: true }
    });

    if (!result?.audioData) {
      throw new Error(`No audio found for sequence ${sequenceId}`);
    }

    return `data:audio/mpeg;base64,${result.audioData}`;
  }

  async getImageUrl(sequenceId: string): Promise<string> {
    const result = await db.query.sequenceMedia.findFirst({
      where: eq(sequenceMedia.sequenceId, sequenceId),
      columns: { imageData: true }
    });

    if (!result?.imageData) {
      throw new Error(`No image found for sequence ${sequenceId}`);
    }

    return `data:image/png;base64,${result.imageData}`;
  }
}

export function getMediaStorage(): MediaStorage {
  return new DatabaseMediaStorage();
}