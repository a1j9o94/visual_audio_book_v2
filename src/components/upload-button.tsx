"use client";

import { useUploadThing } from "~/utils/uploadthing";

export function UploadButton() {
  const { startUpload, isUploading } = useUploadThing("audioUploader", {
    onClientUploadComplete: (res) => {
      console.log("Upload completed", res);
    },
    onUploadError: (err) => {
      console.error("Upload error", err);
    },
  });

  return (
    <input
      type="file"
      accept="audio/*"
      onChange={(e) => {
        const file = e.target.files?.[0];
        if (file) void startUpload([file]);
      }}
      disabled={isUploading}
    />
  );
} 