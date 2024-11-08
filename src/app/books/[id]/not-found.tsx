export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-[#2e026d] to-[#15162c] text-white">
      <h1 className="text-4xl font-bold">Book Not Found</h1>
      <p className="mt-4 text-gray-400">
        The book you&apos;re looking for doesn&apos;t exist or has been removed.
      </p>
    </main>
  );
}
