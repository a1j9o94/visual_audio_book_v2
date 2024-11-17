import { S3Client } from "@aws-sdk/client-s3";

export const s3Client = new S3Client({
  endpoint: process.env.MINIO_ENDPOINT, // MinIO endpoint
  region: "us-east-1", // Arbitrary value
  credentials: {
    accessKeyId: process.env.MINIO_ACCESS_ID ?? "",
    secretAccessKey: process.env.MINIO_PASSWORD ?? "",
  },
  forcePathStyle: true, // Required for MinIO compatibility
});