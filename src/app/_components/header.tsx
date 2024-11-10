import Link from "next/link";
import { auth } from "~/server/auth";
import { BookSearch } from "./book-search";
import { UserNav } from "./user-nav";
import { Menu } from "lucide-react";

export async function Header() {
  const session = await auth();

  return (
    <header className="sticky top-0 z-50 w-full border-b border-white/10 bg-[#2e026d]/80 backdrop-blur supports-[backdrop-filter]:bg-[#2e026d]/60">
      <div className="container mx-auto px-4">
        <div className="flex h-14 items-center justify-between gap-2 md:h-16 md:gap-4">
          {/* Logo */}
          <Link 
            href="/" 
            className="flex shrink-0 items-center"
          >
            <span className="text-lg font-bold text-white md:text-xl">
              VABooks
            </span>
          </Link>

          {/* Search - hidden on mobile */}
          <div className="hidden flex-1 max-w-xl md:block">
            <BookSearch />
          </div>

          {/* Navigation */}
          <nav className="flex items-center gap-2 md:gap-4">
            <Link 
              href="/library" 
              className="hidden text-sm font-medium text-white/80 transition-colors hover:text-white md:block"
            >
              Library
            </Link>
            {session ? (
              <UserNav user={session.user} />
            ) : (
              <Link
                href="/api/auth/signin"
                className="rounded-full bg-white/10 px-3 py-1.5 text-sm font-semibold text-white no-underline transition hover:bg-white/20 md:px-4 md:py-2"
              >
                Sign in
              </Link>
            )}
            <button 
              className="rounded-md p-2 hover:bg-white/10 md:hidden"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5 text-white" />
            </button>
          </nav>
        </div>
        
        {/* Mobile search bar */}
        <div className="border-t border-white/10 pb-2 pt-2 md:hidden">
          <BookSearch />
        </div>
      </div>
    </header>
  );
}
