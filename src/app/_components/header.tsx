import Link from "next/link";
import { auth } from "~/server/auth";

export async function Header() {
  const session = await auth();

  return (
    <header className="bg-[#2e026d] py-4 shadow-lg">
      <div className="container mx-auto flex items-center justify-between px-4">
        <Link href="/" className="text-2xl font-bold text-white hover:opacity-80">
          Visual Audio Books
        </Link>
        
        <div className="flex items-center gap-4">
          {session ? (
            <>
              <span className="text-sm text-white">
                Signed in as {session.user?.name}
              </span>
              <Link
                href="/api/auth/signout"
                className="rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-white no-underline transition hover:bg-white/20"
              >
                Sign out
              </Link>
            </>
          ) : (
            <Link
              href="/api/auth/signin"
              className="rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-white no-underline transition hover:bg-white/20"
            >
              Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
