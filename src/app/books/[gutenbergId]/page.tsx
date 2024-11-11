import { api } from "~/trpc/server";
import { notFound, redirect } from "next/navigation";
import Image from "next/image";
import { auth } from "~/server/auth";
import { type Metadata } from "next";
import { ProcessSequencesButton } from "./_components/process-sequences-button";
import Link from "next/link";
import { PlayCircle } from "lucide-react";
import { RemoveFromLibraryButton } from "./_components/remove-from-library-button";
import { GutenbergBook } from "~/app/_components/gutenberg-book";

interface PageProps {
  params: Promise<{
    gutenbergId: string;
  }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

export default async function BookPage({ params }: PageProps) {
  const session = await auth();
  if (!session) {
    redirect(`/login?returnUrl=/books/${(await params).gutenbergId}`);
  }
  
  const { gutenbergId } = await params;
  
  try {
    // First try to get the book from our database
    const bookId = await api.book.getBookIdByGutenbergId.call({ input: gutenbergId, session }, gutenbergId);
    
    // If it's not in our database, try to get it from Project Gutenberg
    if (!bookId) {
      const bookId = await api.book.getBookIdByGutenbergId.call({ input: gutenbergId, session }, gutenbergId);
      if (!bookId) {
        notFound();
      }
      const book = await api.book.getById.call({ input: bookId, session }, bookId);
      
      // If we can't find it on Gutenberg either, show the not found page
      if (!book) {
        notFound();
      }

      // Show the Gutenberg book page with option to add to library
      return (
        <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-[#2e026d] to-[#15162c] text-white">
          <h1 className="text-4xl font-bold">Book Not Found</h1>
          <p className="mt-4 text-gray-400">
            This book isn&apos;t in your library yet.
          </p>
          <GutenbergBook book={{
            id: book.id,
            gutenbergId: book.gutenbergId!,
            title: book.title,
            author: book.author,
          }} />
        </main>
      );
    }

    // Get the book details from our database
    const book = await api.book.getById.call({ input: bookId, session }, bookId);
    if (!book) {
      notFound();
    }

    // Get sequence count and user progress
    const sequenceCount = await api.sequence.getCompletedCount.call({ input: { bookId }, session }, { bookId });
    const userProgress = book.userProgress?.[0];

    const isInLibrary = book.userProgress && book.userProgress.length > 0;

    return (
      <div className="container mx-auto px-4 py-8 md:py-16">
        {/* Mobile Layout */}
        <div className="flex flex-col gap-6 md:hidden">
          {/* Title Section */}
          <div className="flex flex-col gap-2">
            <h1 className="text-2xl font-bold">{book.title}</h1>
            <p className="text-gray-300">by {book.author}</p>
          </div>

          {/* Continue Reading Button - Mobile */}
          {sequenceCount > 0 && (
            <Link
              href={`/books/${gutenbergId}/play${userProgress ? `?startSequence=${userProgress.lastSequenceNumber}` : ''}`}
              className="flex items-center justify-center gap-2 rounded-lg bg-white/10 px-6 py-3 font-semibold text-white transition-colors hover:bg-white/20"
            >
              <PlayCircle className="h-5 w-5" />
              {userProgress ? 'Continue Reading' : 'Start Reading'}
            </Link>
          )}

          {/* Book Cover - Mobile */}
          {book.coverImageUrl && (
            <div className="relative aspect-[2/3] w-full overflow-hidden rounded-lg">
              <Image
                src={book.coverImageUrl}
                alt={book.title}
                priority
                fill
                className="object-cover"
                sizes="100vw"
              />
            </div>
          )}

          {/* Book Details - Mobile */}
          {sequenceCount > 0 ? (
            <div className="rounded-lg bg-white/5 p-4">
              <h2 className="mb-3 text-lg font-semibold">Reading Progress</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-400">Total Sequences</p>
                  <p className="text-xl font-bold">{sequenceCount}</p>
                </div>
                {userProgress && (
                  <div>
                    <p className="text-sm text-gray-400">Last Read</p>
                    <p className="text-xl font-bold">Sequence {userProgress.lastSequenceNumber}</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4 rounded-lg bg-white/5 p-4">
              <p className="text-center text-sm text-gray-400">
                This book needs to be processed before you can start reading.
              </p>
              <ProcessSequencesButton 
                bookId={book.id} 
                numSequences={10}
                variant="primary"
                className="mt-2"
              />
            </div>
          )}

          {/* Library Button - Mobile */}
          <div className="mt-auto">
            {isInLibrary ? (
              <RemoveFromLibraryButton 
                bookId={book.id}
                className="w-full"
              />
            ) : (
              <GutenbergBook 
                book={{
                  id: book.id,
                  gutenbergId: book.gutenbergId!,
                  title: book.title,
                  author: book.author,
                  coverImageUrl: book.coverImageUrl,
                }} 
              />
            )}
          </div>
        </div>

        {/* Desktop Layout */}
        <div className="hidden grid-cols-1 gap-8 md:grid md:grid-cols-[300px_1fr]">
          {/* Book Cover and Info */}
          <div className="flex flex-col gap-4">
            {book.coverImageUrl && (
              <div className="relative aspect-[2/3] w-full overflow-hidden rounded-lg">
                <Image
                  src={book.coverImageUrl}
                  alt={book.title}
                  priority
                  fill
                  className="object-cover"
                  sizes="(min-width: 768px) 300px, 100vw"
                />
              </div>
            )}
            <div className="flex flex-col gap-2">
              <h1 className="text-2xl font-bold">{book.title}</h1>
              <p className="text-gray-300">by {book.author}</p>
              <p className="text-sm text-gray-400">Status: {book.status}</p>
            </div>

            {/* Library Button - Desktop */}
            <div className="mt-auto">
              {isInLibrary ? (
                <RemoveFromLibraryButton 
                  bookId={book.id}
                  className="mt-auto"
                />
              ) : (
                <GutenbergBook 
                  book={{
                    id: book.id,
                    gutenbergId: book.gutenbergId!,
                    title: book.title,
                    author: book.author,
                    coverImageUrl: book.coverImageUrl,
                  }} 
                />
              )}
            </div>
          </div>

          {/* Book Details and Progress */}
          <div className="flex flex-col gap-8">
            {sequenceCount > 0 ? (
              <>
                <div className="rounded-lg bg-white/5 p-6">
                  <h2 className="mb-4 text-xl font-semibold">Reading Progress</h2>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <p className="text-sm text-gray-400">Total Sequences</p>
                      <p className="text-2xl font-bold">{sequenceCount}</p>
                    </div>
                    {userProgress && (
                      <div>
                        <p className="text-sm text-gray-400">Last Read</p>
                        <p className="text-2xl font-bold">Sequence {userProgress.lastSequenceNumber}</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-col gap-4">
                  <Link
                    href={`/books/${gutenbergId}/play${userProgress ? `?startSequence=${userProgress.lastSequenceNumber}` : ''}`}
                    className="flex items-center justify-center gap-2 rounded-lg bg-white/10 px-6 py-3 font-semibold text-white transition-colors hover:bg-white/20"
                  >
                    <PlayCircle className="h-5 w-5" />
                    {userProgress ? 'Continue Reading' : 'Start Reading'}
                  </Link>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center gap-4 rounded-lg bg-white/5 p-6">
                <p className="text-center text-lg text-gray-400">
                  This book needs to be processed before you can start reading.
                </p>
                <ProcessSequencesButton 
                  bookId={book.id} 
                  numSequences={10}
                  variant="primary"
                  className="mt-4"
                />
              </div>
            )}
          </div>
        </div>
      </div>
    );
  } catch (error) {
    console.error('Error in BookPage:', error);
    throw error;
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { gutenbergId } = await params;
  const session = await auth();
  
  try {
    const bookId = await api.book.getBookIdByGutenbergId.call({ input: gutenbergId, session }, gutenbergId);
    
    if (!bookId) {
      return {
        title: 'Book Not Found',
        description: 'The requested book could not be found',
      };
    }

    const book = await api.book.getById.call({ input: bookId, session }, bookId);
    if (!book) {
      return {
        title: 'Book Not Found',
        description: 'The requested book could not be found',
      };
    }

    return {
      title: book.title,
      description: `${book.title} by ${book.author}`,
    };
  } catch (error) {
    console.error('Error generating metadata:', error);
    return {
      title: 'Error',
      description: 'An error occurred while loading the book',
    };
  }
}
