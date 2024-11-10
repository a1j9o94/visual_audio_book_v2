"use client";

import { signOut } from "next-auth/react";
import { useSearchParams } from "next/navigation";

export default function LogoutPage() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-gray-900 to-black">
      <div className="w-full max-w-md space-y-8 rounded-lg bg-gray-800/50 p-8 text-center shadow-xl backdrop-blur-sm">
        <h2 className="text-2xl font-bold text-white">Sign Out</h2>
        <p className="text-gray-400">Are you sure you want to sign out?</p>
        
        <div className="mt-8 flex flex-col gap-4">
          <button
            onClick={() => signOut({ callbackUrl })}
            className="w-full rounded-lg bg-red-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
          >
            Yes, Sign Out
          </button>
          
          <button
            onClick={() => window.location.href = callbackUrl}
            className="w-full rounded-lg bg-gray-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
} 