import { api } from "~/trpc/server";
import { notFound } from "next/navigation";
import { auth } from "~/server/auth";
import { SequencePlayer } from "~/app/books/[gutenbergId]/play/_components/sequence-player";
import { type Metadata } from "next";

type Params = {
  gutenbergId: string;
};

type PageProps = {
  params: Promise<Params>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

// Define the type that matches what the API returns
type APISequence = {
  sequence: {
    id: string;
    sequenceNumber: number;
    content: string;
  };
  media: {
    audioData: string | null;
    imageData: string | null;
    audioUrl: string | null;
    imageUrl: string | null;
  } | null;
};

// Transform API sequence to player sequence
function transformSequence(apiSequence: APISequence) {
  // Check if sequence exists and has required media
  if (!apiSequence?.sequence || !apiSequence?.media?.audioUrl || !apiSequence?.media?.imageUrl) {
    return null;
  }

  return {
    id: apiSequence.sequence.id,
    sequenceNumber: apiSequence.sequence.sequenceNumber,
    content: apiSequence.sequence.content,
    media: {
      audioUrl: apiSequence.media.audioUrl,
      imageUrl: apiSequence.media.imageUrl
    }
  };
}

export default async function BookPlayPage({ params }: PageProps) {
  const session = await auth();
  if (!session) {
    notFound();
  }

  try {
    const resolvedParams = await params;
    const { gutenbergId } = resolvedParams;
    if (!gutenbergId) {
      notFound();
    }

    const bookId = await api.book.getBookIdByGutenbergId(gutenbergId);
    if(!bookId) {
      notFound();
    }
    
    const book = await api.book.getById(bookId);
    if (!book) {
      notFound();
    }

    // Get user's progress
    const userProgress = book.userProgress?.[0];
    const lastSequenceNumber = userProgress?.lastSequenceNumber ?? 0;

    // Transform sequences and filter out any null results
    const sequences = (book.sequences ?? [])
      .map(transformSequence)
      .filter((seq): seq is NonNullable<typeof seq> => seq !== null);

    if (sequences.length === 0) {
      return (
        <main className="flex min-h-screen flex-col bg-gradient-to-b from-[#2e026d] to-[#15162c] text-white">
          <div className="container mx-auto flex h-screen flex-col px-4 py-16">
            <h1 className="mb-8 text-2xl font-bold">
              {book.title} - Processing
            </h1>
            <p className="text-gray-300">
              This book is still being processed. Please check back later.
            </p>
          </div>
        </main>
      );
    }

    return (
      <main className="flex min-h-screen flex-col bg-gradient-to-b from-[#2e026d] to-[#15162c] text-white">
        <div className="container mx-auto flex h-screen flex-col px-4 py-16">
          <h1 className="mb-8 text-2xl font-bold">
            {book.title} - Playback
          </h1>
          <SequencePlayer 
            sequences={sequences}
            initialSequence={lastSequenceNumber}
            gutenbergId={gutenbergId}
          />
        </div>
      </main>
    );
  } catch (error) {
    console.error('Error in BookPlayPage:', error);
    notFound();
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  try {
    const { gutenbergId } = await params;
    
    if (!gutenbergId) {
      return {
        title: 'Book Not Found',
        description: 'The requested book could not be found',
      };
    }

    const bookId = await api.book.getBookIdByGutenbergId(gutenbergId);
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
