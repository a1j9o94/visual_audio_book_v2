import { z } from "zod";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "../trpc";
import { sequences, userSequenceHistory } from "~/server/db/schema";
import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { nanoid } from "nanoid";

export const sequenceRouter = createTRPCRouter({
  getByBookId: publicProcedure
    .input(z.string())
    .query(async ({ ctx, input: bookId }) => {
      return await ctx.db.query.sequences.findMany({
        where: eq(sequences.bookId, bookId),
        orderBy: (sequences, { asc }) => [asc(sequences.sequenceNumber)],
        with: {
          media: true,
          metadata: true,
        },
      });
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
}); 