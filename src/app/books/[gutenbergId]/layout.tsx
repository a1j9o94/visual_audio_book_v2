import Link from "next/link";
import { type ReactNode } from "react";
import { api } from "~/trpc/server";
import { notFound } from "next/navigation";
import { ProcessSequencesButton } from "./_components/process-sequences-button";
import { ChevronLeft, PlayCircle, Plus } from "lucide-react";

type Props = {
  children: ReactNode;
  params: Promise<{
    gutenbergId: string;
    sequenceNumber: string;
  }>;
};

export default async function BookLayout({ children, params }: Props) {
  const resolvedParams = await params;
  const { gutenbergId } = resolvedParams;
  
  const bookId = await api.book.getBookIdByGutenbergId(gutenbergId);
  if(!bookId) {
    notFound();
  }

  const book = await api.book.getById(bookId);
  if(!book) {
    notFound();
  }
  
  const completeSequences = await api.sequence.getCompletedCount({ bookId });

  return (
    <div className="flex flex-col">
      <nav className="sticky top-[3.5rem] z-40 border-b border-white/10 bg-[#2e026d]/80 backdrop-blur supports-[backdrop-filter]:bg-[#2e026d]/60 md:top-16">
        <div className="container mx-auto px-4">
          <div className="flex h-12 items-center justify-between md:h-14">
            {/* Left section */}
            <div className="flex items-center gap-2 md:gap-4">
              <Link
                href="/"
                className="flex items-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium text-white/80 transition-colors hover:text-white md:gap-2 md:text-sm"
              >
                <ChevronLeft className="h-3 w-3 md:h-4 md:w-4" />
                Back
              </Link>
              <div className="h-4 w-px bg-white/10" />
              <Link
                href={`/books/${book.gutenbergId}`}
                className="truncate text-xs font-medium text-white/80 transition-colors hover:text-white md:text-sm"
                title={book.title}
              >
                {book.title.length > 15 ? `${book.title.slice(0, 12)}...` : book.title}
              </Link>
            </div>

            {/* Right section */}
            <div className="flex items-center gap-2 md:gap-4">
              <span className="hidden text-xs text-white/60 md:block md:text-sm">
                {completeSequences} sequences ready
              </span>
              <Link
                href={`/books/${book.gutenbergId}/play`}
                className="flex items-center gap-1 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-white/20 md:gap-2 md:px-4 md:py-2 md:text-sm"
              >
                <PlayCircle className="h-3 w-3 md:h-4 md:w-4" />
                <span className="hidden md:inline">Play Book</span>
                <span className="md:hidden">Play</span>
              </Link>
              {/* Desktop Process Button */}
              <ProcessSequencesButton 
                bookId={bookId} 
                numSequences={5}
                variant="secondary"
                className="hidden md:block"
              />
              {/* Mobile Process Button */}
              <ProcessSequencesButton 
                bookId={bookId} 
                numSequences={5}
                variant="secondary"
                className="md:hidden"
                icon={<Plus className="h-3 w-3" />}
                compact
              />
            </div>
          </div>
        </div>
      </nav>
      <main className="flex-1">
        {children}
      </main>
    </div>
  );
}
