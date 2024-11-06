import Link from "next/link";
import { auth } from "~/server/auth";
import { api, HydrateClient } from "~/trpc/server";
import Image from "next/image";

import type { inferRouterOutputs } from '@trpc/server';
import type { AppRouter } from '~/server/api/root';

//type RouterInput = inferRouterInputs<AppRouter>;
type RouterOutput = inferRouterOutputs<AppRouter>;

function BookList({ books }: { books: RouterOutput["book"]["getAll"] }) {
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

export default async function Home() {
  const session = await auth();
  const books = await api.book.getAll();

  if (!books) return null;

  return (
    <HydrateClient>
      <main className="flex min-h-screen flex-col bg-gradient-to-b from-[#2e026d] to-[#15162c] text-white">
        <div className="container mx-auto px-4 py-16">
          <div className="mb-12 flex items-center justify-between">
            <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
              Visual Audio Books
            </h1>
            <div className="flex items-center gap-4">
              {session ? (
                <>
                  <span className="text-sm">
                    Signed in as {session.user?.name}
                  </span>
                  <Link
                    href="/api/auth/signout"
                    className="rounded-full bg-white/10 px-4 py-2 text-sm font-semibold no-underline transition hover:bg-white/20"
                  >
                    Sign out
                  </Link>
                </>
              ) : (
                <Link
                  href="/api/auth/signin"
                  className="rounded-full bg-white/10 px-4 py-2 text-sm font-semibold no-underline transition hover:bg-white/20"
                >
                  Sign in
                </Link>
              )}
            </div>
          </div>

          {books.length > 0 ? (
            <BookList books={books} />
          ) : (
            <div className="text-center">
              <p className="text-xl text-gray-400">No books available yet.</p>
              {session && (
                <Link
                  href="/books/new"
                  className="mt-4 inline-block rounded-full bg-white/10 px-6 py-3 font-semibold no-underline transition hover:bg-white/20"
                >
                  Add a New Book
                </Link>
              )}
            </div>
          )}
        </div>
      </main>
    </HydrateClient>
  );
}
