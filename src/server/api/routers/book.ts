import { z } from "zod";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "../trpc";
import { books, userBookProgress } from "~/server/db/schema";
import { eq, and } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import axios from "axios";

interface OpenLibraryBook {
  title: string;
  author_name?: string[];
  id_project_gutenberg?: string[];
  cover_i?: number;
  first_publish_year?: number;
}

export const bookRouter = createTRPCRouter({
  getAll: publicProcedure.query(async ({ ctx }) => {
    const books = await ctx.db.query.books.findMany({
      orderBy: (books, { desc }) => [desc(books.createdAt)],
    });
    
    console.log('GetAll books:', books);
    
    return books;
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

  search: publicProcedure
    .input(z.string())
    .query(async ({ input: query }) => {
      try {
        const searchUrl = `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&fields=title,author_name,cover_i,first_publish_year,id_project_gutenberg`;
        const response = await axios.get<{ docs: OpenLibraryBook[] }>(searchUrl);
        
        const booksWithGutenberg = response.data.docs
          .map((book) => ({
            title: book.title,
            author: book.author_name?.[0] ?? 'Unknown Author',
            gutenbergId: book.id_project_gutenberg?.[0] ?? null,
            coverId: book.cover_i,
            firstPublishYear: book.first_publish_year,
          }))
          .filter((book): book is (typeof book & { gutenbergId: string }) => 
            book.gutenbergId !== null && book.gutenbergId !== undefined
          );

        console.log("Books with Gutenberg:", booksWithGutenberg);
        console.log('API Response Docs:', response.data.docs);

        return booksWithGutenberg;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to search books: ${message}`,
        });
      }
    }),

  addToLibrary: protectedProcedure
    .input(z.object({
      gutenbergId: z.string(),
      title: z.string(),
      author: z.string(),
      coverId: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Check if book already exists
      const existingBook = await ctx.db.query.books.findFirst({
        where: eq(books.gutenbergId, input.gutenbergId),
      });

      if (existingBook) {
        // Check if user already has this book
        const userProgress = await ctx.db.query.userBookProgress.findFirst({
          where: and(
            eq(userBookProgress.bookId, existingBook.id),
            eq(userBookProgress.userId, ctx.session.user.id)
          ),
        });

        if (userProgress) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'Book already in your library',
          });
        }

        // Add book to user's library
        await ctx.db.insert(userBookProgress).values({
          userId: ctx.session.user.id,
          bookId: existingBook.id,
          lastSequenceNumber: 0,
        });

        return existingBook;
      }

      // Create new book without processing
      const coverImageUrl = input.coverId 
        ? `https://covers.openlibrary.org/b/id/${input.coverId}-L.jpg`
        : undefined;

      const [book] = await ctx.db.insert(books).values({
        gutenbergId: input.gutenbergId,
        title: input.title,
        author: input.author,
        coverImageUrl,
        status: "pending", // We'll process it later
      }).returning();

      if (!book) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to create book',
        });
      }

      // Add initial progress record for user
      await ctx.db.insert(userBookProgress).values({
        userId: ctx.session.user.id,
        bookId: book.id,
        lastSequenceNumber: 0,
      });

      return book;
    }),
}); 