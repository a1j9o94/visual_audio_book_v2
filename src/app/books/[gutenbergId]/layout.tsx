import Link from "next/link";
import { cn } from "~/lib/utils";
import { type ReactNode } from "react";
import { api } from "~/trpc/server";
import { notFound } from "next/navigation";
import { ProcessSequencesButton } from "./_components/process-sequences-button";

type Props = {
  children: ReactNode;
  params: Promise<{
    gutenbergId: string;
    sequenceNumber: string;
  }>;
};

// Add this type definition (adjust according to your actual sequence type)

export default async function BookLayout({ children, params }: Props) {
  const resolvedParams = await params;
  const { gutenbergId } = resolvedParams;
  if(!api.book.getBookIdByGutenbergId) {
    console.error('Endpoint not found');
    return;
  }
  const bookId = await api.book.getBookIdByGutenbergId(gutenbergId);
  if(!bookId) {
    notFound();
  }

  if(!api.book.getById) {
    console.error('Endpoint not found');
    return;
  }

  const book = await api.book.getById(bookId);
  if(!book) {
    notFound();
  }
  //check if we have access to the seauence number if we do, it's a sequence page. This is a server compoonent. We can't use pathname
  const isSequencePage = resolvedParams.sequenceNumber !== undefined;

  const sequences = await api.sequence.getByBookId(bookId);
  const completeSequences = sequences.filter(seq => seq.status === "completed").length;

  return (
    <div className="flex flex-col">
      <nav className="sticky top-0 z-10 border-b border-white/10 bg-[#2e026d]/80 backdrop-blur-sm">
        <div className="container mx-auto px-4">
          <div className="flex h-14 items-center space-x-4">
            <Link
              href="/"
              className={cn(
                "flex items-center space-x-2 rounded-md px-3 py-2 text-sm font-medium",
                "hover:bg-white/10"
              )}
            >
              ← Back to Library
            </Link>
            <div className="h-4 w-px bg-white/10" />
            <Link
              href={`/books/${book.gutenbergId}`}
              className={cn(
                "flex items-center space-x-2 rounded-md px-3 py-2 text-sm font-medium",
                "hover:bg-white/10",
                !isSequencePage ? "bg-white/10" : ""
              )}
            >
              {book.title}
            </Link>
            <div className="ml-auto flex items-center space-x-4">
              <span className="text-sm text-white/80">
                {completeSequences} sequences complete
              </span>
              <Link
                href={`/books/${book.gutenbergId}/play`}
                className={cn(
                  "flex items-center space-x-2 rounded-md px-3 py-2 text-sm font-medium",
                  "bg-blue-500 hover:bg-blue-600 text-white"
                )}
              >
                Play Book
              </Link>
              <ProcessSequencesButton 
                bookId={bookId} 
                numSequences={5}
                variant="secondary"
              />
            </div>
          </div>
        </div>
      </nav>
      <main className="flex min-h-screen flex-col bg-gradient-to-b from-[#2e026d] to-[#15162c] text-white">
        {children}
      </main>
    </div>
  );
}
