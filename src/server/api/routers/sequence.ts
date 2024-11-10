import { z } from "zod";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "../trpc";
import { sequences, userSequenceHistory, sequenceMedia, sequenceMetadata, userBookProgress } from "~/server/db/schema";
import { eq, and, asc, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

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

export const sequenceRouter = createTRPCRouter({
  getByBookId: publicProcedure
    .input(z.string())
    .query(async ({ ctx, input: bookId }) => {
      console.log('Getting sequences for book:', bookId);
      const results = await ctx.db.select({
        sequence: sequences,
        media: sequenceMedia,
        metadata: sequenceMetadata,
      })
        .from(sequences)
        .leftJoin(
          sequenceMedia,
          eq(sequences.id, sequenceMedia.sequenceId),
        )
        .leftJoin(
          sequenceMetadata,
          eq(sequences.id, sequenceMetadata.sequenceId),
        )
        .where(
          and(
            eq(sequences.bookId, bookId),
            eq(sequences.status, "completed"),
          ),
        )
        .orderBy(asc(sequences.sequenceNumber));

      return results.map(result => ({
        ...result.sequence,
        media: createMediaUrls(result.media),
        metadata: result.metadata,
      }));
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
      const { sequenceId, timeSpent, completed, bookId } = input;
      
      await ctx.db.transaction(async (tx) => {
        // Update sequence history
        await tx.insert(userSequenceHistory).values({
          userId: ctx.session.user.id,
          sequenceId,
          timeSpent,
          completed,
        });

        // Update book progress
        await tx.update(userBookProgress)
          .set({
            totalTimeSpent: sql`${userBookProgress.totalTimeSpent} + ${timeSpent}`,
            lastReadAt: new Date(),
          })
          .where(and(
            eq(userBookProgress.userId, ctx.session.user.id),
            eq(userBookProgress.bookId, bookId)
          ));
      });
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

      console.log('Found sequence:', sequence);

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
}); 