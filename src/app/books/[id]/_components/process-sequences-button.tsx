'use client';

import { useState } from "react";
import { api } from "~/trpc/react";


export function ProcessSequencesButton({ bookId }: { bookId: string }) {
  const [error, setError] = useState<string | null>(null);

  const mutation = api.book.processSequences.useMutation({
    onError: (err) => {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
    },
  });

  const handleClick = () => {
    setError(null);
    mutation.mutate({ bookId });
  };

  return (
    <div>
      <button
        onClick={handleClick}
        disabled={mutation.isPending}
        className="rounded bg-blue-500 px-4 py-2 text-white hover:bg-blue-600 disabled:bg-gray-400"
      >
        {mutation.isPending ? "Processing..." : "Process Sequences"}
      </button>
      {error && <p className="mt-2 text-red-500">{error}</p>}
    </div>
  );
} 