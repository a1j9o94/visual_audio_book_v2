import { auth } from "~/server/auth";
import { redirect } from "next/navigation";
import { ClearHistoryButton } from "./_components/clear-history-button";

export default async function SettingsPage() {
  const session = await auth();
  if (!session) {
    redirect('/?returnUrl=/settings');
  }

  return (
    <main className="flex min-h-screen flex-col bg-gradient-to-b from-[#2e026d] to-[#15162c] text-white">
      <div className="container mx-auto px-4 py-16">
        <h1 className="mb-8 text-3xl font-bold">Settings</h1>
        
        <div className="rounded-lg bg-white/5 p-6">
          <h2 className="text-xl font-semibold">Reading History</h2>
          <p className="mt-2 text-sm text-gray-400">
            Clear all your reading progress and history. This action cannot be undone.
          </p>
          <div className="mt-4">
            <ClearHistoryButton />
          </div>
        </div>
      </div>
    </main>
  );
}