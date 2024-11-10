import { api } from "~/trpc/server";
import { SequencePlayer } from "./_components/sequence-player";
import { type Metadata } from "next";
import NotFound from "./not-found";
import { auth } from "~/server/auth";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";

interface PlayPageProps {
  params: Promise<{
    gutenbergId: string;
  }>;
  searchParams: Promise<{
    startSequence?: string;
  }>;
}

export default async function BookPlayPage({
  params,
  searchParams,
}: PlayPageProps) {
  const session = await auth();
  if (!session) {
    redirect(`/?returnUrl=/books/${(await params).gutenbergId}/play`);
  }

  const { gutenbergId } = await params;
  const bookId = await api.book.getBookIdByGutenbergId(gutenbergId);
  if (!bookId) {
    return <NotFound />;
  }
  
  const book = await api.book.getById(bookId);
  if (!book) {
    return <NotFound />;
  }
  
  try {
    const sequences = await api.sequence.getByBookId({ 
      bookId, 
      startSequence: 0, 
      numberOfSequences: 10 
    });
    
    const count = await api.sequence.getCompletedCount({ bookId });
    const totalSequences = Number(count);

    let startSequenceNumber = 0;
    if(await searchParams) {
      startSequenceNumber = (await searchParams)?.startSequence ? parseInt((await searchParams).startSequence!) : 0;
    }
    
    return (
      <div className="fixed inset-0 h-screen w-screen overflow-hidden md:relative md:min-h-[calc(100vh-8rem)] md:w-auto">
        {/* Back button and title overlays - hidden on mobile */}
        <div className="hidden md:block">
          <div className="absolute left-4 top-4 z-10">
            <Link
              href={`/books/${gutenbergId}`}
              className="flex items-center gap-2 rounded-full bg-black/50 px-4 py-2 text-sm font-medium text-white backdrop-blur-sm transition-colors hover:bg-black/60"
            >
              <ChevronLeft className="h-4 w-4" />
              Back to Book
            </Link>
          </div>

          <div className="absolute left-1/2 top-4 z-10 -translate-x-1/2">
            <div className="rounded-full bg-black/50 px-6 py-2 text-center backdrop-blur-sm">
              <h1 className="text-sm font-medium text-white">
                {book.title}
              </h1>
            </div>
          </div>
        </div>

        {/* Main player */}
        <div className="h-full">
          <SequencePlayer 
            sequences={sequences}
            initialSequence={startSequenceNumber}
            gutenbergId={gutenbergId}
            totalSequences={totalSequences}
            bookId={bookId}
          />
        </div>
      </div>
    );
  } catch (error) {
    console.error('Error in BookPlayPage:', error);
    return <NotFound />;
  }
}

export async function generateMetadata(props: PlayPageProps): Promise<Metadata> {
  try {
    const { gutenbergId } = await props.params;
    
    if (!gutenbergId) {
      return {
        title: 'Book Not Found',
        description: 'The requested book could not be found',
      };
    }

    const bookId = await api.book.getBookIdByGutenbergId(gutenbergId);
    if (!bookId) {
      return {
        title: 'Book Not Found',
        description: 'The requested book could not be found',
      };
    }
    const book = await api.book.getById(bookId);
    
    return {
      title: `Playing: ${book?.title ?? 'Book Not Found'}`,
      description: `Listen and watch ${book?.title} by ${book?.author}`,
    };
  } catch {
    return {
      title: 'Book Not Found',
      description: 'The requested book could not be found',
    };
  }
}
