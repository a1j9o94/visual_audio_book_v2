'use client';

import Image from "next/image";
import Link from "next/link";
import { GutenbergBook } from "./gutenberg-book";

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

// Type guard to check if a Book is a GutenbergBook
function isGutenbergBook(book: Book): boolean {
  return typeof book.gutenbergId === 'string';
}

interface BookListProps {
  books: Book[];
  isSearchResults?: boolean;
}

export function BookList({ books, isSearchResults }: BookListProps) {

  if (!books?.length) return null;

  const BookContent = ({ book }: { book: Book }) => (
    <>
      {(book.coverImageUrl ?? book.gutenbergId) && (
        <div className="relative aspect-[2/3] w-full overflow-hidden rounded-lg">
          <Image
            src={book.coverImageUrl ?? `https://www.gutenberg.org/cache/epub/${book.gutenbergId}/${book.gutenbergId}-cover.png`}
            alt={book.title}
            fill
            priority
            className="object-cover"
            sizes="(min-width: 1024px) 25vw, (min-width: 768px) 33vw, (min-width: 640px) 50vw, 100vw"
          />
        </div>
      )}
      <h3 className="mt-4 text-lg font-bold text-white/90">{book.title}</h3>
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
      {books.map((book) => {
        if (isSearchResults && isGutenbergBook(book)) {
          return (
            <GutenbergBook 
              key={book.gutenbergId} 
              book={{
                id: book.id!,
                gutenbergId: book.gutenbergId!,
                title: book.title,
                author: book.author,
              }} 
            />
          );
        }

        console.log('Library book:', book.title);
        
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