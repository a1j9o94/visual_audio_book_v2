// src/server/storage/index.ts
import { createUploadthing, type FileRouter } from "uploadthing/next";
import { UTApi } from "uploadthing/server";
import { db } from "~/server/db";
import { sequenceMedia } from "~/server/db/schema";
import { eq } from "drizzle-orm";
import { Blob } from 'node:buffer';

const f = createUploadthing();

interface UploadThingToken {
  apiKey: string;
  appId: string;
  regions: string[];
}

let utapiInstance: UTApi | null = null;

function getUtApi() {
  if (!utapiInstance) {
    console.log('Initializing UploadThing API with config:', {
      hasToken: !!process.env.UPLOADTHING_TOKEN,
      tokenLength: process.env.UPLOADTHING_TOKEN?.length ?? 0,
      environment: process.env.NODE_ENV
    });

    if (!process.env.UPLOADTHING_TOKEN) {
      throw new Error('UPLOADTHING_TOKEN is required but not set');
    }

    try {
      // Validate token format
      const decoded = JSON.parse(
        Buffer.from(process.env.UPLOADTHING_TOKEN, 'base64').toString('utf-8')
      ) as UploadThingToken;

      console.log('Token validation:', {
        hasApiKey: !!decoded.apiKey,
        hasAppId: !!decoded.appId,
        regions: decoded.regions
      });

      utapiInstance = new UTApi({
        token: process.env.UPLOADTHING_TOKEN,
        fetch: fetch,
      });
    } catch (error) {
      console.error('Failed to initialize UploadThing:', error);
      throw error;
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
  getAudioUrl(sequenceId: string): Promise<string>;
  getImageUrl(sequenceId: string): Promise<string>;
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
    console.log('[Storage] Starting audio upload:', {
      bookId,
      sequenceId,
      bufferSize: buffer.length,
      hasUtApi: !!this.utapi
    });

    try {
      // Create a proper Blob object that matches the expected type
      const blob = new Blob([buffer], { type: 'audio/mpeg' }) as unknown as File & {
        name: string;
        lastModified?: number;
      };
      
      // Add required properties to make it FileEsque
      Object.defineProperties(blob, {
        name: {
          value: `${sequenceId}.mp3`,
          writable: false
        },
        lastModified: {
          value: Date.now(),
          writable: false
        }
      });

      console.log('[Storage] Initiating upload to UploadThing');
      const uploadResponse = await this.utapi.uploadFiles(blob);
      
      console.log('[Storage] Raw upload response:', {
        response: JSON.stringify(uploadResponse),
        error: uploadResponse.error,
        data: uploadResponse.data
      });
      
      if (!uploadResponse?.data?.url) {
        throw new Error('Upload failed - no URL in response');
      }

      return uploadResponse.data.url;
    } catch (error) {
      console.error('[Storage] Audio upload error:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        bookId,
        sequenceId,
        isUploadThingError: error instanceof Error && error.message.includes('UploadThing')
      });
      throw error;
    }
  }

  async saveImage(bookId: string, sequenceId: string, buffer: Buffer): Promise<string> {
    console.log('[Storage] Starting image upload:', {
      bookId,
      sequenceId,
      bufferSize: buffer.length,
      hasUtApi: !!this.utapi
    });
    
    try {
      // Create a proper Blob object that matches the expected type
      const blob = new Blob([buffer], { type: 'image/png' }) as unknown as File & {
        name: string;
        lastModified?: number;
      };
      
      // Add required properties to make it FileEsque
      Object.defineProperties(blob, {
        name: {
          value: `${sequenceId}.png`,
          writable: false
        },
        lastModified: {
          value: Date.now(),
          writable: false
        }
      });

      console.log('[Storage] Initiating upload to UploadThing');
      const uploadResponse = await this.utapi.uploadFiles(blob);

      console.log('[Storage] Raw upload response:', {
        response: JSON.stringify(uploadResponse),
        error: uploadResponse.error,
        data: uploadResponse.data
      });
      
      if (!uploadResponse?.data?.url) {
        throw new Error('Upload failed - no URL in response');
      }

      return uploadResponse.data.url;
    } catch (error) {
      console.error('[Storage] Image upload error:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        bookId,
        sequenceId,
        isUploadThingError: error instanceof Error && error.message.includes('UploadThing')
      });
      throw error;
    }
  }

  async getAudioUrl(sequenceId: string): Promise<string> {
    const result = await db.query.sequenceMedia.findFirst({
      where: eq(sequenceMedia.sequenceId, sequenceId),
      columns: { audioUrl: true }
    });

    if (!result?.audioUrl) {
      throw new Error(`No audio URL found for sequence ${sequenceId}`);
    }

    return result.audioUrl;
  }

  async getImageUrl(sequenceId: string): Promise<string> {
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