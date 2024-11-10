import Link from "next/link";
import { cn } from "~/lib/utils";
import { type ReactNode } from "react";
import { api } from "~/trpc/server";
import { notFound } from "next/navigation";
import { ProcessSequencesButton } from "./_components/process-sequences-button";
import React from "react";

type Props = {
  children: ReactNode;
  params: Promise<{
    gutenbergId: string;
    sequenceNumber: string;
  }>;
};

export type LayoutData = {
  book: NonNullable<Awaited<ReturnType<typeof api.book.getById>>>;
  sequences: NonNullable<Awaited<ReturnType<typeof api.sequence.getByBookId>>>;
  bookId: string;
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
  
  // Get completed sequences count
  const completeSequences = await api.sequence.getCompletedCount({ bookId });

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
