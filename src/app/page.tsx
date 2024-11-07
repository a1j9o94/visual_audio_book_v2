import Link from "next/link";
import { auth } from "~/server/auth";
import { api, HydrateClient } from "~/trpc/server";
import { BookList } from "./_components/book-list";

export default async function Home() {
  const session = await auth();
  const books = await api.book.getAll();

  if (!books) return null;

  return (
    <HydrateClient>
      <main className="flex min-h-screen flex-col bg-gradient-to-b from-[#2e026d] to-[#15162c] text-white">
        <div className="container mx-auto px-4 py-16">
          <h1 className="mb-12 text-4xl font-extrabold tracking-tight sm:text-5xl">
            Welcome to Visual Audio Books
          </h1>

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
