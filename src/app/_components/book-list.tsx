import Link from "next/link";
import Image from "next/image";
import type { inferRouterOutputs } from '@trpc/server';
import type { AppRouter } from '~/server/api/root';

type RouterOutput = inferRouterOutputs<AppRouter>;

interface BookListProps {
  books: RouterOutput["book"]["getAll"]
}

export function BookList({ books }: BookListProps) {
  if (!books) return null;
  
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
      {books.map((book) => (
        <Link
          key={book.id}
          href={`/books/${book.id}`}
          className="flex flex-col gap-2 rounded-xl bg-white/10 p-4 hover:bg-white/20"
        >
          {book.coverImageUrl && (
            <div className="relative aspect-[2/3] w-full overflow-hidden rounded-lg">
              <Image
                src={book.coverImageUrl}
                alt={book.title}
                fill
                className="object-cover"
                sizes="(min-width: 1024px) 25vw, (min-width: 768px) 33vw, (min-width: 640px) 50vw, 100vw"
              />
            </div>
          )}
          <h3 className="text-lg font-bold">{book.title}</h3>
          <p className="text-sm text-gray-300">by {book.author}</p>
          <div className="mt-auto">
            <span className="text-xs text-gray-400">
              Status: {book.status}
            </span>
          </div>
        </Link>
      ))}
    </div>
  );
} 