import React from "react";
import Link from "next/link";
import { cn } from "~/lib/utils";
import { type ReactNode } from "react";
import { auth } from "~/server/auth";
import { redirect } from "next/navigation";

type Props = {
  children: ReactNode;
  params: Promise<{
    id: string;
  }>;
};

export default async function SequenceLayout({ children, params }: Props) {
  const session = await auth();
  if (!session) {
    redirect(`/?returnUrl=/sequences/${(await params).id}`);
  }

  return (
    <div className="flex flex-col">
      <nav className="sticky top-0 z-10 border-b border-white/10 bg-[#2e026d]/80 backdrop-blur-sm">
        <div className="container mx-auto px-4">
          <div className="flex h-14 items-center space-x-4">
            <Link
              href="/"
              className={cn(
                "flex items-center space-x-2 rounded-md px-3 py-2 text-sm font-medium",
                "hover:bg-white/10"
              )}
            >
              ← Back to Library
            </Link>
          </div>
        </div>
      </nav>
      <main className="flex min-h-screen flex-col bg-gradient-to-b from-[#2e026d] to-[#15162c] text-white">
        {children}
      </main>
    </div>
  );
}
