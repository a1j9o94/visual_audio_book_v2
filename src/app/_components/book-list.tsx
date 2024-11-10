'use client';

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { api } from "~/trpc/react";
import { useRouter } from "next/navigation";

export interface Book {
  id?: string;
  title: string;
  author: string;
  gutenbergId?: string;
  language?: string;
  coverId?: number;
  firstPublishYear?: number;
  coverImageUrl?: string;
}

interface BookListProps {
  books: Book[];
  isSearchResults?: boolean;
}

export function BookList({ books, isSearchResults }: BookListProps) {
  const router = useRouter();
  const [addingBook, setAddingBook] = useState<string | null>(null);
  
  const addToLibrary = api.book.addToLibrary.useMutation({
    onSuccess: () => {
      router.refresh();
      setAddingBook(null);
    },
    onError: (error) => {
      console.error('Failed to add book:', error);
      alert(error.message);
      setAddingBook(null);
    },
  });

  if (!books?.length) return null;
  
  const handleAddToLibrary = async (book: Book) => {
    if (!book.gutenbergId) return;
    
    setAddingBook(book.gutenbergId);
    addToLibrary.mutate({
      gutenbergId: book.gutenbergId,
      title: book.title,
      author: book.author,
      coverId: book.coverId,
    });
  };

  const BookContent = ({ book }: { book: Book }) => (
    <>
      {(book.coverId ?? book.coverImageUrl) && (
        <div className="relative aspect-[2/3] w-full overflow-hidden rounded-lg">
          <Image
            src={book.coverImageUrl ?? `https://covers.openlibrary.org/b/id/${book.coverId}-L.jpg`}
            alt={book.title}
            fill
            className="object-cover"
            sizes="(min-width: 1024px) 25vw, (min-width: 768px) 33vw, (min-width: 640px) 50vw, 100vw"
          />
        </div>
      )}
      <h3 className="text-lg font-bold">{book.title}</h3>
      <p className="text-sm text-gray-300">by {book.author}</p>
      {book.firstPublishYear && (
        <p className="text-xs text-gray-400">
          First published: {book.firstPublishYear}
        </p>
      )}
    </>
  );
  
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
      {books.map((book, index) => {
        if (isSearchResults) {
          return (
            <div
              key={book.gutenbergId ?? index}
              className="flex flex-col gap-2 rounded-xl bg-white/10 p-4 hover:bg-white/20"
            >
              <BookContent book={book} />
              {book.gutenbergId && (
                <button
                  onClick={() => handleAddToLibrary(book)}
                  disabled={addingBook === book.gutenbergId}
                  className="mt-2 rounded-lg bg-white/10 px-4 py-2 text-center text-sm font-semibold hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {addingBook === book.gutenbergId ? 'Adding...' : 'Add to Library'}
                </button>
              )}
            </div>
          );
        }

        console.log('Library book:', book);
        
        if (!book.id) {
          console.warn('Book missing ID:', book);
          return null;
        }

        return (
          <Link
            key={book.gutenbergId}
            href={`/books/${book.gutenbergId}`}
            className="flex flex-col gap-2 rounded-xl bg-white/10 p-4 hover:bg-white/20"
          >
            <BookContent book={book} />
          </Link>
        );
      })}
    </div>
  );
} 