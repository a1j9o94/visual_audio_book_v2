import { z } from "zod";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "../trpc";
import { sequences, userSequenceHistory, sequenceMedia, sequenceMetadata } from "~/server/db/schema";
import { eq, and, asc } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { nanoid } from "nanoid";

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

      console.log('Sequences:', results);

      // Double-check media exists even for completed sequences
      return results.filter(
        (result) => result.media?.audioUrl && result.media?.imageUrl
      );
    }),

  getById: publicProcedure
    .input(z.string())
    .query(async ({ ctx, input: sequenceId }) => {
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

      return sequence;
    }),

  updateProgress: protectedProcedure
    .input(z.object({
      sequenceId: z.string(),
      timeSpent: z.number(),
      completed: z.boolean(),
      preferences: z.record(z.unknown()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { sequenceId, timeSpent, completed, preferences } = input;
      
      return await ctx.db.insert(userSequenceHistory).values({
        id: nanoid(),
        sequenceId,
        userId: ctx.session.user.id,
        timeSpent,
        completed,
        preferences,
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

      return sequence;
    }),
}); 