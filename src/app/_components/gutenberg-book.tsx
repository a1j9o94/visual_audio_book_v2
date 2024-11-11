'use client';

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "~/trpc/react";

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
}

export function GutenbergBook({ book }: GutenbergBookProps) {
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
    <div className="mt-8 rounded-xl bg-white/10 p-6">
      <h2 className="text-2xl font-bold">{book.title}</h2>
      <p className="mt-2 text-gray-300">by {book.author}</p>
      <div className="mt-4 flex gap-4">
        <button
          onClick={handleAddToLibrary}
          disabled={isAdding}
          className="rounded-lg bg-white/10 px-4 py-2 font-semibold hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isAdding ? 'Adding to Library...' : 'Add to Library'}
        </button>
        <a
          href={`https://www.gutenberg.org/ebooks/${book.gutenbergId}`}
          target="_blank"
          rel="noopener noreferrer" 
          className="rounded-lg bg-white/10 px-4 py-2 font-semibold hover:bg-white/20"
        >
          View on Project Gutenberg
        </a>
      </div>
    </div>
  );
} 