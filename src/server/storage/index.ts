// src/server/storage/index.ts
import { db } from "~/server/db";
import { sequenceMedia } from "~/server/db/schema";
import { s3Client } from "./minioClient";
import { PutObjectCommand } from "@aws-sdk/client-s3";

// Media storage interface
interface MediaStorage {
  saveAudio(bookId: string, sequenceId: string, buffer: Buffer): Promise<URL>;
  saveImage(bookId: string, sequenceId: string, buffer: Buffer): Promise<URL>;
  getAudioUrl(sequenceId: string): Promise<URL>;
  getImageUrl(sequenceId: string): Promise<URL>;
}

export class S3MediaStorage implements MediaStorage {
  private readonly bucketName = process.env.MINIO_BUCKET_NAME;
  private readonly baseUrl = process.env.MINIO_ENDPOINT; // MinIO host URL

  async saveAudio(bookId: string, sequenceId: string, buffer: Buffer): Promise<URL> {
    const key = `audio/${bookId}/${sequenceId}.mp3`;
    
    await s3Client.send(
      new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: buffer,
        ContentType: "audio/mpeg",
      })
    );

    const url = `${this.baseUrl}/${this.bucketName}/${key}`;

    if (!url) {
      throw new Error(`Failed to save audio for sequence ${sequenceId}`);
    }

    if (!db) {
      throw new Error(`Database is not initialized`);
    }

    if (!isValidUrl(url)) {
      throw new Error(`Invalid URL format for sequence ${sequenceId}`);
    }

    await db.insert(sequenceMedia)
      .values({ 
        sequenceId,
        audioUrl: url,
        updatedAt: new Date() 
      })
      .onConflictDoUpdate({
        target: sequenceMedia.sequenceId,
        set: {
          audioUrl: url,
          updatedAt: new Date()
        }
      });

    return new URL(url);
  }

  async saveImage(bookId: string, sequenceId: string, buffer: Buffer): Promise<URL> {
    const key = `images/${bookId}/${sequenceId}.png`;

    await s3Client.send(
      new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: buffer,
        ContentType: "image/png",
      })
    );
    
    const url = `${this.baseUrl}/${this.bucketName}/${key}`;

    if (!url) { 
      throw new Error(`Failed to save image for sequence ${sequenceId}`);
    }

    await db.insert(sequenceMedia)
      .values({ 
        sequenceId,
        imageUrl: url,
        updatedAt: new Date() 
      })
      .onConflictDoUpdate({
        target: sequenceMedia.sequenceId,
        set: {
          imageUrl: url,
          updatedAt: new Date()
        }
      });

    return new URL(url);
  }

  async getAudioUrl(sequenceId: string): Promise<URL> {
    const key = `audio/${sequenceId}.mp3`;
    return new URL(`${this.baseUrl}/${this.bucketName}/${key}`);
  }

  async getImageUrl(sequenceId: string): Promise<URL> {
    const key = `images/${sequenceId}.png`;
    return new URL(`${this.baseUrl}/${this.bucketName}/${key}`);
  }
}


export function getMediaStorage(): MediaStorage {
  return new S3MediaStorage();
}

function isValidUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}