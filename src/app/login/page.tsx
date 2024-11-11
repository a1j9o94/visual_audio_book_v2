"use client";

import { signIn } from "next-auth/react";
import { FaDiscord, FaGoogle } from "react-icons/fa";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function LoginContent() {
  const searchParams = useSearchParams();
  const returnUrl = searchParams.get("returnUrl") ?? "/";

  return (
    <div className="w-full max-w-md space-y-8 rounded-lg bg-gray-800/50 p-8 shadow-xl backdrop-blur-sm">
      <div className="text-center">
        <h2 className="mt-6 text-3xl font-bold tracking-tight text-white">
          Welcome to Visual Audio Books
        </h2>
        <p className="mt-2 text-sm text-gray-400">
          Sign in to continue your reading journey
        </p>
      </div>

      <div className="mt-8 space-y-4">
        <button
          onClick={() => signIn("google", { callbackUrl: returnUrl })}
          className="flex w-full items-center justify-center gap-3 rounded-lg bg-white px-4 py-3 text-sm font-semibold text-gray-900 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
        >
          <FaGoogle className="h-5 w-5" />
          Continue with Google
        </button>

        <button
          onClick={() => signIn("discord", { callbackUrl: returnUrl })}
          className="flex w-full items-center justify-center gap-3 rounded-lg bg-[#5865F2] px-4 py-3 text-sm font-semibold text-white hover:bg-[#4752C4] focus:outline-none focus:ring-2 focus:ring-[#5865F2] focus:ring-offset-2"
        >
          <FaDiscord className="h-5 w-5" />
          Continue with Discord
        </button>
      </div>

      <div className="mt-8 text-center text-sm text-gray-400">
        By signing in, you agree to our{" "}
        <a href="/terms-of-service" className="text-blue-400 hover:text-blue-300">
          Terms of Service
        </a>{" "}
        and{" "}
        <a href="/privacy-policy" className="text-blue-400 hover:text-blue-300">
          Privacy Policy
        </a>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-gray-900 to-black">
      <Suspense fallback={<div>Loading...</div>}>
        <LoginContent />
      </Suspense>
    </div>
  );
}
