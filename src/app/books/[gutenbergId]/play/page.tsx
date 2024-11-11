import { api } from "~/trpc/server";
import { SequencePlayer } from "./_components/sequence-player";
import { type Metadata } from "next";
import NotFound from "./not-found";
import { auth } from "~/server/auth";
import { redirect } from "next/navigation";

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
    redirect(`/login?returnUrl=/books/${(await params).gutenbergId}/play`);
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

  const startSequence = (await searchParams)?.startSequence ? parseInt((await searchParams).startSequence!) : 0;
  
  try {
    const sequences = await api.sequence.getByBookId({ 
      bookId, 
      startSequence: startSequence, 
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
