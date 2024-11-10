import { BookList } from "./_components/book-list";
import type { Book } from "./_components/book-list";
import { api } from "~/trpc/server";
import { auth } from "~/server/auth";

type PageProps = {
  searchParams?: Promise<{ q?: string }>;
};

export default async function Home({ searchParams }: PageProps) {
  const params = await searchParams;
  const query = params?.q;
  const session = await auth();
  
  // Only search if there's a query
  const searchResults = query ? await api.book.search(query) : null;
  
  // Get books based on auth status
  const libraryBooks = session 
    ? await api.book.getUserLibrary()
    : await api.book.getAll();

  return (
    <main className="flex min-h-screen flex-col bg-gradient-to-b from-[#2e026d] to-[#15162c] text-white">
      <div className="container mx-auto px-4 py-16">
        {/* Search Results - Only show if there was a search */}
        {query && (
          <div className="mb-12">
            <h2 className="mb-4 text-2xl font-bold">Search Results for &ldquo;{query}&rdquo;</h2>
            {searchResults && searchResults.length > 0 ? (
              <BookList 
                books={searchResults} 
                isSearchResults 
              />
            ) : (
              <div className="rounded-lg bg-white/5 p-8 text-center">
                <p className="text-lg text-gray-400">
                  No books found matching your search.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Library Section */}
        <div>
          <h2 className="mb-4 text-2xl font-bold">
            {session ? 'Your Library' : 'Available Books'}
          </h2>
          {libraryBooks.length > 0 ? (
            <BookList 
              books={libraryBooks as Book[]}
            />
          ) : (
            <div className="rounded-lg bg-white/5 p-8 text-center">
              <p className="text-lg text-gray-400">
                {session 
                  ? 'Your library is empty. Search for books to add them.'
                  : 'Sign in to start building your library.'
                }
              </p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}