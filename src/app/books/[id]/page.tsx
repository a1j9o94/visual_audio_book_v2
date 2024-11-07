import { api } from "~/trpc/server";
import { notFound } from "next/navigation";
import Image from "next/image";
import { auth } from "~/server/auth";

export default async function BookPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await auth();
  
  try {
    const book = await api.book.getById(params.id);

    if (!book) {
      notFound();
    }

    return (
      <main className="flex min-h-screen flex-col bg-gradient-to-b from-[#2e026d] to-[#15162c] text-white">
        <div className="container mx-auto px-4 py-16">
          <div className="grid grid-cols-1 gap-8 md:grid-cols-[300px_1fr]">
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
                {book.userProgress && (
                  <div className="mt-2 rounded-lg bg-white/5 p-4">
                    <h3 className="text-sm font-semibold">Your Progress</h3>
                    <p className="text-xs text-gray-400">
                      Last read: Sequence {book.userProgress.lastSequenceNumber}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Sequences */}
            <div className="flex flex-col gap-4">
              <h2 className="text-xl font-semibold">Sequences</h2>
              {book.sequences?.length > 0 ? (
                <div className="grid gap-4">
                  {book.sequences.map((sequence) => (
                    <div
                      key={sequence.id}
                      className="rounded-lg bg-white/5 p-4 hover:bg-white/10"
                    >
                      <p className="text-sm">
                        Sequence {sequence.sequenceNumber}
                      </p>
                      <p className="mt-2 text-gray-300">{sequence.content}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-400">
                  No sequences available yet. The book is being processed.
                </p>
              )}
            </div>
          </div>
        </div>
      </main>
    );
  } catch (error) {
    notFound();
  }
}