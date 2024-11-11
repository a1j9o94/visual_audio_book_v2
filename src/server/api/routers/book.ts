import { z } from "zod";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "../trpc";
import { books, userBookProgress, sequences, userSequenceHistory } from "~/server/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import axios from "axios";
import { addJob } from "~/server/queue/queues";
import { parseGutenbergText } from "~/utils/parseGutenberg";


interface OpenLibraryBook {
  title: string;
  author_name?: string[];
  id_project_gutenberg?: string[];
  cover_i?: number;
  first_publish_year?: number;
  language?: string[];
}

interface GutenbergBook {
  title: string;
  author: string;
  gutenbergId: string;
  coverImageUrl?: string;
}

const getGutenbergBook = async (gutenbergId: string): Promise<GutenbergBook | null> => {
  try {
    // First try the .txt format
    let rawText: string | null = null;
    try {
      const response = await axios.get<string>(
        `https://www.gutenberg.org/cache/epub/${gutenbergId}/pg${gutenbergId}.txt`,
        { timeout: 5000 }
      );
      rawText = response.data;
    } catch {
      console.log('Failed to fetch .txt format, trying UTF-8...');
      // If .txt fails, try the UTF-8 format
      const response = await axios.get<string>(
        `https://www.gutenberg.org/files/${gutenbergId}/${gutenbergId}-0.txt`,
        { timeout: 5000 }
      );
      rawText = response.data;
    }

    if (!rawText) {
      console.error('Failed to fetch book text from Gutenberg');
      return null;
    }

    const metadata = await parseGutenbergText(rawText);
    if (!metadata) {
      console.error('Failed to parse book metadata');
      return null;
    }

    // Check if cover image exists
    const coverImageUrl = `https://www.gutenberg.org/cache/epub/${gutenbergId}/${gutenbergId}-cover.png`;
    let hasCover = false;
    try {
      const coverResponse = await axios.head(coverImageUrl, { timeout: 2000 });
      hasCover = coverResponse.status === 200;
    } catch {
      console.log('No cover image found for book:', gutenbergId);
    }

    return {
      title: metadata.title,
      author: metadata.author,
      gutenbergId,
      coverImageUrl: hasCover ? coverImageUrl : undefined,
    };

  } catch (error) {
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 404) {
        console.log('Book not found on Gutenberg');
        return null;
      }
      console.error('Axios error:', error.message);
    } else {
      console.error('Unknown error:', error);
    }
    
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to fetch or parse book from Project Gutenberg',
    });
  }
};

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

      // Only select the essential sequence fields
      const bookSequences = await ctx.db
        .select({
          id: sequences.id,
          sequenceNumber: sequences.sequenceNumber,
          status: sequences.status,
        })
        .from(sequences)
        .where(and(
          eq(sequences.bookId, input),
          eq(sequences.status, 'completed')
        ))
        .orderBy(sequences.sequenceNumber);

      console.log('Found sequences:', bookSequences.length);

      return {
        ...book,
        sequences: bookSequences
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

  searchOpenLibrary: publicProcedure
    .input(z.string())
    .query(async ({ input: query }) => {
      try {
        // Use OpenLibrary for search only
        const searchUrl = `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&language=eng&fields=title,author_name,id_project_gutenberg,language`;
        const response = await axios.get<{ docs: OpenLibraryBook[] }>(searchUrl);
        
        const booksWithGutenberg = response.data.docs
          .map((book) => ({
            title: book.title,
            author: book.author_name?.[0] ?? 'Unknown Author',
            gutenbergId: book.id_project_gutenberg?.[0] ?? null,
            language: book.language?.[0] ?? undefined,
          }))
          .filter((book): book is (typeof book & { gutenbergId: string }) => (
            book.gutenbergId !== null && 
            book.gutenbergId !== undefined &&
            (!book.language || book.language.toLowerCase() === 'eng')
          ));

        // For each book with a Gutenberg ID, try to get the actual metadata from Gutenberg
        const verifiedBooks = await Promise.all(
          booksWithGutenberg.map(async (book) => {
            const gutenbergBook = await getGutenbergBook(book.gutenbergId);
            return gutenbergBook ?? book;
          })
        );

        return verifiedBooks.filter((book): book is GutenbergBook => book !== null);
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
      const gutenbergId = String(input);
      console.log('Searching for Gutenberg ID:', gutenbergId);
      
      try {
        // Use a transaction to handle potential race conditions
        const result = await ctx.db.transaction(async (tx) => {
          // First try to find the existing book
          const existingBook = await tx.query.books.findFirst({
            where: eq(books.gutenbergId, gutenbergId),
          });

          if (existingBook) {
            console.log('Found existing book:', existingBook.title);
            return existingBook.id;
          }

          // If book doesn't exist, fetch from Gutenberg
          const gutenbergBook = await getGutenbergBook(gutenbergId);
          if (!gutenbergBook) {
            console.log('Book not found on Gutenberg');
            return null;
          }

          // Create the book using upsert pattern
          const [newBook] = await tx
            .insert(books)
            .values({
              gutenbergId,
              title: gutenbergBook.title,
              author: gutenbergBook.author,
              status: "pending",
              coverImageUrl: gutenbergBook.coverImageUrl,
            })
            .onConflictDoUpdate({
              target: books.gutenbergId,
              set: {
                title: gutenbergBook.title,
                author: gutenbergBook.author,
                status: "pending",
                coverImageUrl: gutenbergBook.coverImageUrl,
              },
            })
            .returning();

          console.log('Created new book:', newBook?.title);
          if (!newBook) {
            throw new TRPCError({
              code: 'INTERNAL_SERVER_ERROR',
              message: 'Failed to create book',
            });
          }
          return newBook.id;
        });

        return result;

      } catch (error) {
        console.error('Error in getBookIdByGutenbergId:', error);
        return null;
      }
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
