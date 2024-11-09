"use client";

import React from "react";
import Link from "next/link";
import { cn } from "~/lib/utils";
import { usePathname } from "next/navigation";

type Props = {
  children: React.ReactNode;
  params: Promise<{
    id: string;
  }>;
};

export default function BookLayout({ children, params }: Props) {
  const resolvedParams = React.use(params);
  const { id } = resolvedParams as { id: string };
  const pathname = usePathname();
  const isSequencePage = pathname.split('/').length > 3;

  return (
    <div>
      <main className="flex min-h-screen flex-col bg-gradient-to-b from-[#2e026d] to-[#15162c] text-white">
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
              <div className="h-4 w-px bg-white/10" />
              <Link
                href={`/books/${id}`}
                className={cn(
                  "flex items-center space-x-2 rounded-md px-3 py-2 text-sm font-medium",
                  "hover:bg-white/10",
                  !isSequencePage ? "bg-white/10" : ""
                )}
              >
                {isSequencePage ? "← Back to Book" : "Overview"}
              </Link>
            </div>
          </div>
        </nav>
        {children}
      </main>
    </div>
  );
}
