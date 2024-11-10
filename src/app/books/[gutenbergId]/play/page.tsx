import { api } from "~/trpc/server";
import { SequencePlayer } from "./_components/sequence-player";
import { type Metadata } from "next";
import NotFound from "./not-found";
import { auth } from "~/server/auth";
import { redirect } from "next/navigation";

interface PlayPageProps{
  params: Promise<{
    gutenbergId: string;
  }>;
  searchParams: Promise<{
    startSequence?: string;
  }>;
};

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
    // Initially fetch only 10 sequences
    const sequences = await api.sequence.getByBookId({ 
      bookId, 
      startSequence: 0, 
      numberOfSequences: 10 
    });
    
    // Get total sequence count - store it in a regular number variable
    const count = await api.sequence.getCompletedCount({ bookId });
    const totalSequences = Number(count); // Ensure it's a number

    let startSequenceNumber = 0;
    if(await searchParams) {
      startSequenceNumber = (await searchParams)?.startSequence ? parseInt((await searchParams).startSequence!) : 0;
    }
    
    return (
      <main className="flex min-h-screen flex-col bg-gradient-to-b from-[#2e026d] to-[#15162c] text-white">
        <div className="container mx-auto flex h-screen flex-col px-4 py-16">
          <h1 className="mb-8 text-2xl font-bold">
            {book.title} - Playback
          </h1>
          <SequencePlayer 
            sequences={sequences}
            initialSequence={startSequenceNumber}
            gutenbergId={gutenbergId}
            totalSequences={totalSequences}
            bookId={bookId}
          />
        </div>
      </main>
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
