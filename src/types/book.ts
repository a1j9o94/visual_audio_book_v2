import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "~/server/api/root";

type RouterOutput = inferRouterOutputs<AppRouter>;

export type Book = RouterOutput["book"]["getById"];

export interface APISequence {
  id: string;
  sequenceNumber: number;
  content: string;
  bookId: string;
  startPosition: number;
  endPosition: number;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  media: {
    id: string;
    sequenceId: string;
    audioUrl: string | null;
    imageUrl: string | null;
    audioData: string | null;
    imageData: string | null;
  } | null;
}

export interface TransformedSequence {
  id: string;
  sequenceNumber: number;
  content: string;
  media: {
    audioUrl: string;
    imageUrl: string;
  };
}
