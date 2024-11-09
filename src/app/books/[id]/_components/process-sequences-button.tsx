'use client';

import { useState } from "react";
import { api } from "~/trpc/react";
import { useRouter } from "next/navigation";

interface ProcessSequencesButtonProps {
  bookId: string;
}

export function ProcessSequencesButton({ bookId }: ProcessSequencesButtonProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const router = useRouter();

  const processSequences = api.book.processSequences.useMutation({
    onSuccess: () => {
      router.refresh();
    },
    onError: (error) => {
      console.error('Failed to process sequences:', error);
      alert(error.message);
      setIsProcessing(false);
    },
  });

  const handleProcess = async () => {
    setIsProcessing(true);
    processSequences.mutate({
      bookId,
      numSequences: 10, // Default to 10 sequences
    });
  };

  return (
    <button
      onClick={handleProcess}
      disabled={isProcessing}
      className="rounded-lg bg-white/10 px-4 py-2 font-semibold text-white hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {isProcessing ? 'Processing...' : 'Generate Sequences'}
    </button>
  );
} 