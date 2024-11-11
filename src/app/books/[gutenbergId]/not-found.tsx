'use client';

import { useParams } from "next/navigation";
import { api } from "~/trpc/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function NotFound() {
  const params = useParams();
  const router = useRouter();
  const gutenbergId = params.gutenbergId as string;
  const [isAdding, setIsAdding] = useState(false);

  // Fetch directly from Project Gutenberg
  const bookId = api.book.getBookIdByGutenbergId.useQuery(gutenbergId, {
    retry: false,
    enabled: !!gutenbergId,
  });

  if (!bookId.data) {
    return <div>Book not found</div>;
  }

  const { data: book, isLoading } = api.book.getById.useQuery(bookId.data);
  if (!book) {
    return <div>Book not found</div>;
  }

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

  const handleAddToLibrary = (book: {
    gutenbergId: string | null;
    title: string | null;
    author: string | null;
  }) => {
    if (!book.gutenbergId || !book.title || !book.author) return;
    
    setIsAdding(true);
    addToLibrary.mutate({
      gutenbergId: book.gutenbergId,
      title: book.title,
      author: book.author,
    });
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-[#2e026d] to-[#15162c] text-white">
      <h1 className="text-4xl font-bold">Book Not Found</h1>
      <p className="mt-4 text-gray-400">
        This book isn&apos;t in our library yet.
      </p>

      {isLoading && (
        <p className="mt-4 text-gray-400">Checking Project Gutenberg...</p>
      )}

      {book && (
        <div className="mt-8 rounded-xl bg-white/10 p-6">
          <h2 className="text-2xl font-bold">{book.title}</h2>
          <p className="mt-2 text-gray-300">by {book.author}</p>
          <div className="mt-4 flex gap-4">
            <button
              onClick={() => handleAddToLibrary(book)}
              disabled={isAdding}
              className="rounded-lg bg-white/10 px-4 py-2 font-semibold hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isAdding ? 'Adding to Library...' : 'Add to Library'}
            </button>
            <a
              href={`https://www.gutenberg.org/ebooks/${gutenbergId}`}
              target="_blank"
              rel="noopener noreferrer" 
              className="rounded-lg bg-white/10 px-4 py-2 font-semibold hover:bg-white/20"
            >
              View on Project Gutenberg
            </a>
          </div>
        </div>
      )}

      {!isLoading && !book && (
        <p className="mt-4 text-gray-400">
          Book not found on Project Gutenberg.
        </p>
      )}
    </main>
  );
}
