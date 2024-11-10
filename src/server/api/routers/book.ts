import { z } from "zod";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "../trpc";
import { books, userBookProgress, sequences, sequenceMedia, userSequenceHistory } from "~/server/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import axios from "axios";
import { addJob } from "~/server/queue/queues";

interface OpenLibraryBook {
  title: string;
  author_name?: string[];
  id_project_gutenberg?: string[];
  cover_i?: number;
  first_publish_year?: number;
  language?: string[];
}

export const bookRouter = createTRPCRouter({
  getAll: publicProcedure.query(async ({ ctx }) => {
    const allBooks = await ctx.db.query.books.findMany({
      orderBy: [desc(books.createdAt)],
      with: {
        userProgress: true,
      }
    });
    
    console.log('GetAll books:', allBooks.map(book => book.title));
    
    return allBooks;
  }),

  getUserLibrary: protectedProcedure.query(async ({ ctx }) => {
    const userProgressEntries = await ctx.db.query.userBookProgress.findMany({
      where: eq(userBookProgress.userId, ctx.session.user.id),
      with: {
        book: true,
      },
    });
    
    return userProgressEntries.map(entry => ({
      ...entry.book,
      userProgress: [entry],
    }));
  }),

  getById: publicProcedure
    .input(z.string())
    .query(async ({ ctx, input }) => {
      console.log('Getting book by id:', input);
      const book = await ctx.db.query.books.findFirst({
        where: eq(books.id, input),
        with: {
          userProgress: true,
        }
      });

      if (!book) return null;
      console.log('Book found:', book.title);

      const bookSequences = await ctx.db.select({
        sequence: sequences,
        media: sequenceMedia,
      })
        .from(sequences)
        .leftJoin(sequenceMedia, eq(sequences.id, sequenceMedia.sequenceId))
        .where(and(
          eq(sequences.bookId, input),
          eq(sequences.status, 'completed')
        ))
        .orderBy(sequences.sequenceNumber);

      console.log('Found sequences:', bookSequences.length);

      return {
        ...book,
        sequences
      };
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
      }).returning();
    }),

  search: publicProcedure
    .input(z.string())
    .query(async ({ input: query }) => {
      try {
        const searchUrl = `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&language=eng&fields=title,author_name,cover_i,first_publish_year,id_project_gutenberg,language`;
        const response = await axios.get<{ docs: OpenLibraryBook[] }>(searchUrl);
        
        const booksWithGutenberg = response.data.docs
          .map((book) => ({
            title: book.title,
            author: book.author_name?.[0] ?? 'Unknown Author',
            gutenbergId: book.id_project_gutenberg?.[0] ?? null,
            coverId: book.cover_i,
            firstPublishYear: book.first_publish_year,
            language: book.language?.[0] ?? undefined,
          }))
          .filter((book): book is (typeof book & { gutenbergId: string }) => (
            book.gutenbergId !== null && 
            book.gutenbergId !== undefined &&
            (!book.language || book.language.toLowerCase() === 'eng')
          ));

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
      const existingBook = await ctx.db.query.books.findFirst({
        where: eq(books.gutenbergId, input.gutenbergId),
      });

      if (existingBook) {
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

        await ctx.db.insert(userBookProgress).values({
          userId: ctx.session.user.id,
          bookId: existingBook.id,
          lastSequenceNumber: 0,
        });

        return existingBook;
      }

      const coverImageUrl = input.coverId 
        ? `https://covers.openlibrary.org/b/id/${input.coverId}-L.jpg`
        : undefined;

      const [book] = await ctx.db.insert(books).values({
        gutenbergId: input.gutenbergId,
        title: input.title,
        author: input.author,
        coverImageUrl,
        status: "pending",
      }).returning();

      if (!book) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to create book',
        });
      }

      await ctx.db.insert(userBookProgress).values({
        userId: ctx.session.user.id,
        bookId: book.id,
        lastSequenceNumber: 0,
      });

      return book;
    }),

  processSequences: protectedProcedure
    .input(z.object({ bookId: z.string(), numSequences: z.number().optional() }))
    .mutation(async ({ ctx, input }) => {
      const { bookId, numSequences = 1 } = input;

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
          bookId: book.id,
          gutenbergId: book.gutenbergId ?? '',
          numSequences,
        },
      });

      return { success: true };
    }),

  getBookIdBySequenceId: publicProcedure
    .input(z.string())
    .query(async ({ ctx, input }) => {
      const sequence = await ctx.db.query.sequences.findFirst({
        where: eq(sequences.id, input),
        columns: {
          bookId: true,
        },
      });

      if (!sequence) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `Sequence with id ${input} not found`,
        });
      }

      return sequence.bookId;
    }),
  getBookIdByGutenbergId: publicProcedure
    .input(z.string())
    .query(async ({ ctx, input }) => {
      console.log('Searching for Gutenberg ID:', input);
      const book = await ctx.db.query.books.findFirst({
        where: eq(books.gutenbergId, input),
      });
      console.log('Found book:', book?.title);
      return book?.id ?? null;
    }),

  removeFromLibrary: protectedProcedure
    .input(z.object({
      bookId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        // Delete the user's progress for this book
        const result = await ctx.db
          .delete(userBookProgress)
          .where(
            and(
              eq(userBookProgress.bookId, input.bookId),
              eq(userBookProgress.userId, ctx.session.user.id)
            )
          )
          .returning();

        if (!result.length) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Book not found in user library',
          });
        }

        return { success: true };
      } catch (error) {
        console.error('Error removing book from library:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to remove book from library',
        });
      }
    }),

  clearUserHistory: protectedProcedure.mutation(async ({ ctx }) => {
    try {
      // Delete all user progress entries
      await ctx.db
        .delete(userBookProgress)
        .where(eq(userBookProgress.userId, ctx.session.user.id))
        .returning();

      // Delete all sequence history
      await ctx.db
        .delete(userSequenceHistory)
        .where(eq(userSequenceHistory.userId, ctx.session.user.id))
        .returning();

      return { success: true };
    } catch (error) {
      console.error('Error clearing user history:', error);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to clear reading history',
      });
    }
  }),
}); 
