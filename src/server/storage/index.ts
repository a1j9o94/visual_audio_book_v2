// src/server/storage/index.ts
import { createUploadthing, type FileRouter } from "uploadthing/next";
import { UTApi } from "uploadthing/server";
import { db } from "~/server/db";
import { sequenceMedia } from "~/server/db/schema";
import { eq } from "drizzle-orm";
import { File, Blob } from 'node:buffer';

const f = createUploadthing();

interface UploadThingToken {
  apiKey: string;
  appId: string;
  regions: string[];
}

let utapiInstance: UTApi | null = null;

function getUtApi() {
  if (!utapiInstance) {
    if (!process.env.UPLOADTHING_TOKEN) {
      throw new Error('UPLOADTHING_TOKEN is required');
    }

    try {
      // Validate token format
      const decoded = JSON.parse(
        Buffer.from(process.env.UPLOADTHING_TOKEN, 'base64').toString('utf-8')
      ) as UploadThingToken;

      // Type guard
      if (!decoded.apiKey || !decoded.appId || !Array.isArray(decoded.regions)) {
        throw new Error('Invalid token structure');
      }

      console.log('Initializing UploadThing API with token:', {
        hasToken: true,
        tokenLength: process.env.UPLOADTHING_TOKEN.length,
        appId: decoded.appId,
        regions: decoded.regions,
      });

      utapiInstance = new UTApi({
        token: process.env.UPLOADTHING_TOKEN,
        fetch: fetch,
      });
    } catch (error) {
      console.error('Failed to initialize UploadThing:', error);
      throw new Error('Invalid UPLOADTHING_TOKEN format');
    }
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

function validateUploadThingToken(token: string | undefined): void {
  if (!token) {
    throw new Error('UPLOADTHING_TOKEN is not set');
  }

  try {
    // Token should be base64 encoded JSON
    const decoded = Buffer.from(token, 'base64').toString('utf-8');
    const parsed = JSON.parse(decoded) as UploadThingToken;
    
    // Check required fields
    if (!parsed.apiKey || !parsed.appId) {
      throw new Error('Token missing required fields');
    }

    console.log('Token validation passed:', {
      hasApiKey: !!parsed.apiKey,
      hasAppId: !!parsed.appId,
      regions: parsed.regions,
    });
  } catch (error) {
    console.error('Token validation failed:', error);
    throw new Error('Invalid UPLOADTHING_TOKEN format');
  }
}

// Use it during initialization
validateUploadThingToken(process.env.UPLOADTHING_TOKEN);

// Uploadthing storage implementation
export class UploadthingMediaStorage implements MediaStorage {
  private utapi: UTApi;

  constructor() {
    this.utapi = getUtApi();
  }

  async saveAudio(bookId: string, sequenceId: string, buffer: Buffer): Promise<string> {
    console.log('Starting audio upload with config:', {
      hasToken: !!process.env.UPLOADTHING_TOKEN,
      tokenLength: process.env.UPLOADTHING_TOKEN?.length ?? 0,
      bookId,
      sequenceId,
      bufferSize: buffer.length,
    });

    try {
      const file = new File([buffer], `${sequenceId}.mp3`, { type: 'audio/mpeg' });
      
      const uploadResponse = await this.utapi.uploadFiles(file);
      
      console.log('Upload response:', uploadResponse);
      
      if (!uploadResponse?.data?.url) {
        throw new Error('Upload failed - no URL in response');
      }

      return uploadResponse.data.url;
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
      const uploadResponse = await this.utapi.uploadFiles(file);

      console.log('Upload response:', uploadResponse);
      
      
      if (!uploadResponse?.data?.url) {
        console.error('Upload failed - no URL in response');
        throw new Error("Upload failed - no URL returned");
      }

      await db
        .insert(sequenceMedia)
        .values({
          sequenceId,
          imageUrl: uploadResponse.data.url,
          generatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: sequenceMedia.sequenceId,
          set: {
            imageUrl: uploadResponse.data.url,
            generatedAt: new Date(),
          },
        });

      return uploadResponse.data.url;
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