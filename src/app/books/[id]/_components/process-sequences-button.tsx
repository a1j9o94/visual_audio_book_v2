'use client';

import { useState } from "react";
import { api } from "~/trpc/react";

interface ProcessSequencesButtonProps {
  bookId: string;
  numSequences?: number;
  variant?: 'primary' | 'secondary';
  className?: string;
}

export function ProcessSequencesButton({ 
  bookId, 
  numSequences = 3,
  variant = 'primary',
  className = ''
}: ProcessSequencesButtonProps) {
  const [error, setError] = useState<string | null>(null);

  const mutation = api.book.processSequences.useMutation({
    onError: (err) => {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
    },
  });

  const handleClick = () => {
    setError(null);
    mutation.mutate({
      bookId,
      numSequences
    });
  };

  const baseStyles = "rounded px-4 py-2 text-white disabled:bg-gray-400";
  const variantStyles = variant === 'primary' 
    ? "bg-blue-500 hover:bg-blue-600" 
    : "bg-gray-500 hover:bg-gray-600";

  return (
    <div>
      <button
        onClick={handleClick}
        disabled={mutation.isPending}
        className={`${baseStyles} ${variantStyles} ${className}`}
      >
        {mutation.isPending ? "Processing..." : numSequences === 1 ? "Generate Next Sequence" : "Process Sequences"}
      </button>
      {error && <p className="mt-2 text-red-500">{error}</p>}
    </div>
  );
} 