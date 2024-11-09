import { BookSearch } from "./_components/book-search";
import { BookList } from "./_components/book-list";
import type { Book } from "./_components/book-list";
import { api } from "~/trpc/server";

type PageProps = {
  searchParams?: Promise<{ q?: string }>;
};

export default async function Home({ searchParams }: PageProps) {
  const params = await searchParams;
  const query = params?.q;
  
  // Only get library books if there's no query
  const libraryBooks = await api.book.getAll();
  
  // Only search if there's a query
  const searchResults = query ? await api.book.search(query) : null;

  return (
    <main className="flex min-h-screen flex-col bg-gradient-to-b from-[#2e026d] to-[#15162c] text-white">
      <div className="container mx-auto px-4 py-16">
        <h1 className="mb-12 text-4xl font-extrabold tracking-tight sm:text-5xl">
          Welcome to Visual Audio Books
        </h1>

        <BookSearch />

        {searchResults && (
          <div className="mb-12">
            <h2 className="mb-4 text-2xl font-bold">Search Results</h2>
            <BookList 
              books={searchResults} 
              isSearchResults 
            />
          </div>
        )}

        <div>
          <h2 className="mb-4 text-2xl font-bold">Your Library</h2>
          {libraryBooks.length > 0 ? (
            <BookList 
              books={libraryBooks as Book[]}
            />
          ) : (
            <div className="text-center">
              <p className="text-xl text-gray-400">
                {query 
                  ? "Search above to find books to add to your library."
                  : "Your library is empty. Search for books to add them."}
              </p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
