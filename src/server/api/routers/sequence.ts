import { z } from "zod";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "../trpc";
import type { sequenceMetadata } from "~/server/db/schema";
import { sequences, userSequenceHistory, userBookProgress, sequenceMedia } from "~/server/db/schema";
import { eq, and, asc, sql, gte, lte } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { addJob } from "~/server/queue/queues";
import type { DbType } from "~/server/db";
import { books } from "~/server/db/schema";

// Helper function to create data URLs
function createMediaUrls(media: typeof sequenceMedia.$inferSelect | null) {
  if (!media) return null;
  
  return {
    ...media,
    audioUrl: media.audioData ? `data:audio/mpeg;base64,${media.audioData}` : null,
    imageUrl: media.imageData ? `data:image/png;base64,${media.imageData}` : null,
  };
}

type MediaWithUrls = ReturnType<typeof createMediaUrls>;

type SequenceWithMedia = typeof sequences.$inferSelect & {
  media: MediaWithUrls;
  metadata: typeof sequenceMetadata.$inferSelect | null;
  characters: {
    character: {
      id: string;
      name: string;
    };
  }[];
};

// Keep track of pending updates
const pendingUpdates = new Map<string, {
  timeSpent: number;
  lastUpdate: number;
  timer: NodeJS.Timeout | null;
  processingPromise: Promise<void> | null;
}>();

const BATCH_INTERVAL = 10000; // 10 seconds

export const sequenceRouter = createTRPCRouter({
  getByBookId: publicProcedure
    //optional input that takes the starting sequence and number of sequences to return
    .input(z.object({
      bookId: z.string(),
      startSequence: z.number().optional(),
      numberOfSequences: z.number().optional(),
    }))
    .query(async ({ ctx, input: { bookId, startSequence, numberOfSequences } }) => {
      console.log('Getting sequences from trpc for book:', bookId);
      const results = await ctx.db.query.sequences.findMany({
        where: and(
          eq(sequences.bookId, bookId),
          eq(sequences.status, "completed"),
          gte(sequences.sequenceNumber, startSequence ?? 0),
          lte(sequences.sequenceNumber, (startSequence ?? 0) + (numberOfSequences ?? 0)),
        ),
        with: {
          metadata: true,
        },
        orderBy: asc(sequences.sequenceNumber),
      });

      if (results.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "No sequences found for this book"
        });
      }

      return results;
    }),

  getSequenceMedia: publicProcedure
    .input(z.string())
    .query(async ({ ctx, input: sequenceId }) => {
      const media = await ctx.db.query.sequenceMedia.findFirst({
        where: eq(sequenceMedia.sequenceId, sequenceId),
      });

      return createMediaUrls(media ?? null);
    }),

  getById: publicProcedure
    .input(z.string())
    .query(async ({ ctx, input: sequenceId }): Promise<SequenceWithMedia> => {
      const sequence = await ctx.db.query.sequences.findFirst({
        where: eq(sequences.id, sequenceId),
        with: {
          media: true,
          metadata: true,
          characters: {
            with: {
              character: true,
            },
          },
        },
      });

      if (!sequence) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Sequence not found"
        });
      }

      // Transform the sequence with computed URLs
      return {
        ...sequence,
        media: createMediaUrls(sequence.media),
      } as SequenceWithMedia;
    }),

  updateProgress: protectedProcedure
    .input(z.object({
      sequenceId: z.string(),
      timeSpent: z.number(),
      completed: z.boolean(),
      bookId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { sequenceId, timeSpent, completed } = input;
      const userId = ctx.session.user.id;
      const key = `${userId}-${sequenceId}`;

      // If this is a completion event, process it immediately
      if (completed) {
        await processUpdate(ctx, input, userId);
        return;
      }

      // Get or create pending update
      const pending = pendingUpdates.get(key) ?? {
        timeSpent: 0,
        lastUpdate: Date.now(),
        timer: null,
        processingPromise: null,
      };

      // Add new time to accumulated time
      pending.timeSpent += timeSpent;

      // Clear existing timer if any
      if (pending.timer) {
        clearTimeout(pending.timer);
      }

      // Set new timer
      pending.timer = setTimeout(() => {
        // Store the promise for potential cleanup
        pending.processingPromise = processUpdate(ctx, {
          ...input,
          timeSpent: pending.timeSpent,
        }, userId).finally(() => {
          pendingUpdates.delete(key);
        });
      }, BATCH_INTERVAL);

      // Store updated pending state
      pendingUpdates.set(key, pending);
    }),

  getByBookIdAndNumber: publicProcedure
    .input(z.object({
      bookId: z.string(),
      sequenceNumber: z.number()
    }))
    .query(async ({ ctx, input }) => {
      console.log('Searching for sequence:', {
        bookId: input.bookId,
        sequenceNumber: input.sequenceNumber
      });

      const sequence = await ctx.db.query.sequences.findFirst({
        where: and(
          eq(sequences.bookId, input.bookId),
          eq(sequences.sequenceNumber, input.sequenceNumber)
        ),
        with: {
          media: true,
          metadata: true,
          characters: {
            with: {
              character: true,
            },
          },
        },
      });

      console.log('Found sequence:', sequence?.id);

      if (!sequence) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Sequence not found for book ${input.bookId} and number ${input.sequenceNumber}`
        });
      }

      // Transform the sequence with computed URLs
      return {
        ...sequence,
        media: createMediaUrls(sequence.media),
      } as SequenceWithMedia;
    }),

  getCompletedCount: publicProcedure
    .input(z.object({ bookId: z.string() }))
    .query(async ({ ctx, input: { bookId } }) => {
      const book = await ctx.db.query.books.findFirst({
        where: eq(books.id, bookId),
        columns: { completedSequenceCount: true }
      });
      
      return book?.completedSequenceCount ?? 0;
    }),
  processSequences: publicProcedure
    .input(z.object({ bookId: z.string(), gutenbergId: z.string(), numSequences: z.number() }))
    .mutation(async ({ ctx, input: { bookId, gutenbergId, numSequences } }) => {

      const book = await ctx.db.query.books.findFirst({
        where: eq(books.id, bookId),
      });

      if (!book) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `Book with id ${bookId} not found`,
        });
      }

      await addJob({
        type: 'book-processing',
        data: {
          bookId,
          gutenbergId,
          numSequences,
        },
      });
    }),
}); 

async function processUpdate(
  ctx: { db: DbType },
  input: {
    sequenceId: string;
    timeSpent: number;
    completed: boolean;
    bookId: string;
  },
  userId: string
): Promise<void> {
  const { sequenceId, timeSpent, completed, bookId } = input;

  await ctx.db.transaction(async (tx) => {
    // Update sequence history
    await tx.insert(userSequenceHistory).values({
      userId,
      sequenceId,
      timeSpent,
      completed,
    });

    const sequence = await tx.query.sequences.findFirst({
      where: eq(sequences.id, sequenceId),
      columns: {
        sequenceNumber: true,
      },
    });

    // Update book progress
    await tx.update(userBookProgress)
      .set({
        totalTimeSpent: sql`${userBookProgress.totalTimeSpent} + ${timeSpent}`,
        lastReadAt: new Date(),
        lastSequenceNumber: sequence?.sequenceNumber ?? 0,
      })
      .where(and(
        eq(userBookProgress.userId, userId),
        eq(userBookProgress.bookId, bookId)
      ));
  });
}
