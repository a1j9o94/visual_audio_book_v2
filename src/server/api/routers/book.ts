import { z } from "zod";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "../trpc";
import { books, userBookProgress, sequences, sequenceMedia, sequenceMetadata } from "~/server/db/schema";
import { eq, and, desc, isNotNull } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import axios from "axios";
import { addJob } from "~/server/queue/queues";

interface OpenLibraryBook {
  title: string;
  author_name?: string[];
  id_project_gutenberg?: string[];
  cover_i?: number;
  first_publish_year?: number;
}

export const bookRouter = createTRPCRouter({
  getAll: publicProcedure.query(async ({ ctx }) => {
    const allBooks = await ctx.db.query.books.findMany({
      orderBy: [desc(books.createdAt)],
      with: {
        userProgress: true,
      }
    });
    
    console.log('GetAll books:', allBooks);
    
    return allBooks;
  }),

  getById: protectedProcedure
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
      console.log('Book found:', book);

      const bookSequences = await ctx.db.select({
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
        .where(and(
          eq(sequences.bookId, input),
          isNotNull(sequenceMedia.audioData),
          isNotNull(sequenceMedia.imageData)
        ))
        .orderBy(desc(sequences.sequenceNumber));

      const transformedSequences = bookSequences.map(seq => ({
        sequence: {
          id: seq.sequence.id,
          sequenceNumber: seq.sequence.sequenceNumber,
          content: seq.sequence.content,
        },
        media: seq.media ? {
          audioData: seq.media.audioData,
          imageData: seq.media.imageData,
          audioUrl: seq.media.audioData ? `data:audio/mpeg;base64,${seq.media.audioData}` : null,
          imageUrl: seq.media.imageData ? `data:image/png;base64,${seq.media.imageData}` : null,
        } : null,
      }));

      return {
        ...book,
        sequences: transformedSequences
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
}); 