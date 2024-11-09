// src/server/storage/index.ts
import { createUploadthing, type FileRouter } from "uploadthing/next";
import { UTApi } from "uploadthing/server";
import { db } from "~/server/db";
import { sequenceMedia } from "~/server/db/schema";
import { eq } from "drizzle-orm";
import { File, Blob } from 'node:buffer';

const f = createUploadthing();

let utapiInstance: UTApi | null = null;

function getUtApi() {
  if (!utapiInstance) {
    utapiInstance = new UTApi({
      token: process.env.UPLOADTHING_TOKEN,
      fetch: fetch,
    });
  }
  return utapiInstance;
}

// Add this debug log
console.log('UploadThing API initialized with token:', process.env.UPLOADTHING_TOKEN ? 'present' : 'missing');

// FileRouter for browser-based uploads
export const uploadRouter = {
  audioUploader: f({
    audio: { maxFileSize: "32MB" }
  })
    .middleware(() => ({ uploadedAt: new Date() }))
    .onUploadComplete(async ({ metadata, file }) => {
      await db.insert(sequenceMedia).values({
        sequenceId: file.key,
        audioUrl: file.url,
        generatedAt: metadata.uploadedAt,
      });
      return { url: file.url };
    }),

  imageUploader: f({
    image: { maxFileSize: "8MB" }
  })
    .middleware(() => ({ uploadedAt: new Date() }))
    .onUploadComplete(async ({ metadata, file }) => {
      await db.insert(sequenceMedia).values({
        sequenceId: file.key,
        imageUrl: file.url,
        generatedAt: metadata.uploadedAt,
      });
      return { url: file.url };
    }),
} satisfies FileRouter;

export type OurFileRouter = typeof uploadRouter;

// Media storage interface
interface MediaStorage {
  saveAudio(bookId: string, sequenceId: string, buffer: Buffer): Promise<string>;
  saveImage(bookId: string, sequenceId: string, buffer: Buffer): Promise<string>;
  getAudioUrl(bookId: string, sequenceId: string): Promise<string>;
  getImageUrl(bookId: string, sequenceId: string): Promise<string>;
}

// Uploadthing storage implementation
export class UploadthingMediaStorage implements MediaStorage {
  private utapi: UTApi;

  constructor() {
    this.utapi = getUtApi();
  }

  async saveAudio(bookId: string, sequenceId: string, buffer: Buffer): Promise<string> {
    console.log('Starting audio upload for sequence:', sequenceId);
    
    const blob = new Blob([buffer], { type: 'audio/mpeg' });
    const file = new File([blob], `${sequenceId}.mp3`, { 
      type: 'audio/mpeg',
    });

    try {
      const response = await this.utapi.uploadFiles([file]);
      console.log('Upload response:', JSON.stringify(response, null, 2));
      
      const uploadedFile = response[0]?.data;
      
      if (!uploadedFile?.url) {
        console.error('Upload failed - no URL in response');
        throw new Error("Upload failed - no URL returned");
      }

      await db
        .insert(sequenceMedia)
        .values({
          sequenceId,
          audioUrl: uploadedFile.url,
          generatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: sequenceMedia.sequenceId,
          set: {
            audioUrl: uploadedFile.url,
            generatedAt: new Date(),
          },
        });

      return uploadedFile.url;
    } catch (error) {
      console.error('Upload error details:', error);
      throw error;
    }
  }

  async saveImage(bookId: string, sequenceId: string, buffer: Buffer): Promise<string> {
    console.log('Starting image upload for sequence:', sequenceId);
    
    // Create a Blob and File instead of UTFile
    const blob = new Blob([buffer], { type: 'image/png' });
    const file = new File([blob], `${sequenceId}.png`, { 
      type: 'image/png',
    });

    try {
      const response = await this.utapi.uploadFiles([file]);
      console.log('Upload response:', JSON.stringify(response, null, 2));
      
      const uploadedFile = response[0]?.data;
      
      if (!uploadedFile?.url) {
        console.error('Upload failed - no URL in response');
        throw new Error("Upload failed - no URL returned");
      }

      await db
        .insert(sequenceMedia)
        .values({
          sequenceId,
          imageUrl: uploadedFile.url,
          generatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: sequenceMedia.sequenceId,
          set: {
            imageUrl: uploadedFile.url,
            generatedAt: new Date(),
          },
        });

      return uploadedFile.url;
    } catch (error) {
      console.error('Upload error details:', error);
      throw error;
    }
  }

  async getAudioUrl(bookId: string, sequenceId: string): Promise<string> {
    const result = await db.query.sequenceMedia.findFirst({
      where: eq(sequenceMedia.sequenceId, sequenceId),
      columns: { audioUrl: true }
    });

    if (!result?.audioUrl) {
      throw new Error(`No audio URL found for sequence ${sequenceId}`);
    }

    return result.audioUrl;
  }

  async getImageUrl(bookId: string, sequenceId: string): Promise<string> {
    const result = await db.query.sequenceMedia.findFirst({
      where: eq(sequenceMedia.sequenceId, sequenceId),
      columns: { imageUrl: true }
    });

    if (!result?.imageUrl) {
      throw new Error(`No image URL found for sequence ${sequenceId}`);
    }

    return result.imageUrl;
  }
}

export function getMediaStorage(): MediaStorage {
  return new UploadthingMediaStorage();
}