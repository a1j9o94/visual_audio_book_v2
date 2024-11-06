import { z } from "zod";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "../trpc";
import { books, userBookProgress } from "~/server/db/schema";
import { eq, and } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

export const bookRouter = createTRPCRouter({
  getAll: publicProcedure.query(async ({ ctx }) => {
    return await ctx.db.query.books.findMany({
      orderBy: (books, { desc }) => [desc(books.createdAt)],
    });
  }),

  getById: publicProcedure
    .input(z.string())
    .query(async ({ ctx, input: bookId }) => {
      const book = await ctx.db.query.books.findFirst({
        where: eq(books.id, bookId),
        with: {
          sequences: {
            orderBy: (sequences, { asc }) => [asc(sequences.sequenceNumber)],
          },
        },
      });

      if (!book) {
        throw new TRPCError({ 
          code: "NOT_FOUND",
          message: "Book not found" 
        });
      }

      if (ctx.session?.user) {
        const progress = await ctx.db.query.userBookProgress.findFirst({
          where: and(
            eq(userBookProgress.bookId, bookId),
            eq(userBookProgress.userId, ctx.session.user.id)
          ),
        });
        return { ...book, userProgress: progress };
      }

      return { ...book, userProgress: null };
    }),

  create: protectedProcedure
    .input(z.object({
      gutenbergId: z.string(),
      title: z.string(),
      author: z.string(),
      coverImageUrl: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return await ctx.db.insert(books).values({
        gutenbergId: input.gutenbergId,
        title: input.title,
        author: input.author,
        coverImageUrl: input.coverImageUrl,
        status: "pending",
      });
    }),
}); 