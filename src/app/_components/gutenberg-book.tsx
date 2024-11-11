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
    <div className={`${showDetails ? "mt-8 rounded-xl bg-white/10 p-6" : ""} ${className}`}>
      {showDetails && (
        <>
          <h2 className="text-2xl font-bold">{book.title}</h2>
          <p className="mt-2 text-gray-300">by {book.author}</p>
        </>
      )}
      <div className={`${showDetails ? "mt-4" : ""} flex flex-col gap-3 sm:flex-row sm:gap-4`}>
        <Button
          onClick={handleAddToLibrary}
          disabled={isAdding}
          className="w-full"
          variant="secondary"
        >
          <Library className="mr-2 h-4 w-4" />
          {isAdding ? 'Adding to Library...' : 'Add to Library'}
        </Button>
        {showDetails && (
          <Button
            asChild
            variant="outline"
            className="w-full"
          >
            <a
              href={`https://www.gutenberg.org/ebooks/${book.gutenbergId}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              View on Project Gutenberg
            </a>
          </Button>
        )}
      </div>
    </div>
  );
} 