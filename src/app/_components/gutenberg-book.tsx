'use client';

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { ExternalLink, Library } from "lucide-react";

export interface GutenbergBook {
  id: string;
  title: string;
  gutenbergId: string;
  coverImageUrl?: string | null;
  author: string;
  firstPublishYear?: number;
}

interface GutenbergBookProps {
  book: GutenbergBook;
  className?: string;
  showDetails?: boolean;
}

export function GutenbergBook({ book, className = "", showDetails = true }: GutenbergBookProps) {
  const router = useRouter();
  const [isAdding, setIsAdding] = useState(false);

  const addToLibrary = api.book.addToLibrary.useMutation({
    onSuccess: (book) => {
      setIsAdding(false);
      router.push(`/books/${book.gutenbergId}`);
      router.refresh();
    },
    onError: (error) => {
      console.error('Failed to add book:', error);
      alert(error.message);
      setIsAdding(false);
    },
  });

  const handleAddToLibrary = () => {
    setIsAdding(true);
    addToLibrary.mutate({
      gutenbergId: book.gutenbergId,
      title: book.title,
      author: book.author,
    });
  };

  return (
    <div className={`${
      showDetails 
        ? "rounded-xl bg-white/5 backdrop-blur-sm border border-white/10 p-6 shadow-lg" 
        : ""
    } ${className}`}>
      {showDetails && (
        <>
          <h2 className="text-2xl font-bold text-white/90">{book.title}</h2>
          <p className="mt-2 text-white/70">by {book.author}</p>
        </>
      )}
      <div className={`${showDetails ? "mt-4" : ""} flex flex-col gap-3 sm:flex-row sm:gap-4`}>
        <Button
          onClick={handleAddToLibrary}
          disabled={isAdding}
          className="w-full bg-white/10 hover:bg-white/20 text-white/90 border-white/10"
          variant="secondary"
        >
          <Library className="mr-2 h-4 w-4" />
          {isAdding ? 'Adding to Library...' : 'Add to Library'}
        </Button>
        {showDetails && (
          <Button
            asChild
            variant="outline"
            className="w-full border-white/10 text-white/80 hover:bg-white/10 hover:text-white truncate"
          >
            <a
              href={`https://www.gutenberg.org/ebooks/${book.gutenbergId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center"
            >
              <ExternalLink className="mr-2 h-4 w-4 flex-shrink-0" />
              <span className="truncate">View on Project Gutenberg</span>
            </a>
          </Button>
        )}
      </div>
    </div>
  );
} 