import { api } from "~/trpc/server";
import { notFound } from "next/navigation";
import Image from "next/image";
import { auth } from "~/server/auth";
import { type Metadata } from "next";
import { ProcessSequencesButton } from "./_components/process-sequences-button";
import Link from "next/link";

type Params = {
  id: string;
};

type PageProps = {
  params: Promise<Params>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function BookPage({ params }: PageProps) {
  const session = await auth();
  if (!session) {
    notFound();
  }
  const { id } = await params;
  
  try {
    const book = await api.book.getById(id);

    if (!book) {
      notFound();
    }

    const sequences = book.sequences ?? [];
    const userProgress = book.userProgress?.[0];

    return (

        <div className="container mx-auto h-screen px-4 py-16">
          <div className="grid h-full grid-cols-1 gap-8 md:grid-cols-[300px_1fr]">
            {/* Book Cover and Info */}
            <div className="flex flex-col gap-4">
              {book.coverImageUrl && (
                <div className="relative aspect-[2/3] w-full overflow-hidden rounded-lg">
                  <Image
                    src={book.coverImageUrl}
                    alt={book.title}
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
                {userProgress && (
                  <div className="mt-2 rounded-lg bg-white/5 p-4">
                    <h3 className="text-sm font-semibold">Your Progress</h3>
                    <p className="text-xs text-gray-400">
                      Last read: Sequence {userProgress.lastSequenceNumber}
                    </p>
                  </div>
                )}
                <div className="mt-4">
                  <ProcessSequencesButton 
                    bookId={book.id} 
                    numSequences={1}
                    variant="secondary"
                  />
                </div>
              </div>
            </div>

            {/* Sequences */}
            <div className="flex flex-col gap-4">
              <h2 className="text-xl font-semibold">Sequences</h2>
              {sequences.length > 0 ? (
                <div className="overflow-y-auto pr-4" style={{ maxHeight: "calc(100vh - 12rem)" }}>
                  <div className="grid gap-4">
                    {sequences.map((sequence) => (
                      <Link
                        key={sequence.sequence.id}
                        href={`/books/${book.id}/${sequence.sequence.sequenceNumber}`}
                        className="block cursor-pointer rounded-lg bg-white/5 p-4 hover:bg-white/10"
                      >
                        <p className="text-sm">
                          Sequence {sequence.sequence.sequenceNumber}
                        </p>
                        <p className="mt-2 text-gray-300">{sequence.sequence.content}</p>
                      </Link>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center">
                  <p className="mb-4 text-gray-400">
                    No sequences available yet.
                  </p>
                  <ProcessSequencesButton bookId={book.id} />
                </div>
              )}
            </div>
          </div>
        </div>
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(message);
    notFound();
  }
}

// Optionally, you can also add metadata generation
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  try {
    const { id } = await params;
    const book = await api.book.getById(id);
    return {
      title: book?.title ?? 'Book Not Found',
      description: `${book?.title} by ${book?.author}`,
    };
  } catch {
    return {
      title: 'Book Not Found',
      description: 'The requested book could not be found',
    };
  }
}
