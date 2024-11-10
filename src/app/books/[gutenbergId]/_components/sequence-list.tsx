'use client';

import { useState } from 'react';
import { api } from "~/trpc/react";
import { useRouter } from 'next/navigation';

type Sequence = {
  id: string;
  sequenceNumber: number;
  content: string;
  status: string;
  createdAt: Date | null;
  updatedAt: Date | null;
};

interface SequenceListProps {
  gutenbergId: string;
  initialSequences: Sequence[];
}

export function SequenceList({ gutenbergId, initialSequences }: SequenceListProps) {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [sequences, setSequences] = useState<Sequence[]>(initialSequences);
  const [isLoading, setIsLoading] = useState(false);

  const loadMore = async () => {
    setIsLoading(true);
    const nextPage = page + 1;
    try {

      if(!api.book.getBookIdByGutenbergId) {
        console.error('Endpoint not found');
        return;
      }

      //@ts-expect-error gutenbergId is not typed
      const bookId = await api.book.getBookIdByGutenbergId(gutenbergId);

      if (!bookId) {
        console.error('Book ID not found');
        return;
      }

      const result = api.sequence.getByBookId.useQuery(bookId);
      
      if (result?.data) {
        const newSequences = result.data.map(item => 
          'sequence' in item ? item.sequence : item
        ) as Sequence[];
        setSequences([...sequences, ...newSequences]);
        setPage(nextPage);
      }
    } catch (error) {
      console.error('Error fetching book ID:', error);
      return;
    }
    setIsLoading(false);
  };

  const handleSequenceClick = (sequence: Sequence) => {
    console.log('Clicking sequence:', sequence);
    router.push(`/books/${gutenbergId}/${sequence.sequenceNumber}`);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-y-auto pr-4 sequence-list-container">
        <div className="grid gap-4">
          {sequences.map((sequence) => (
            <div
              key={sequence.id}
              onClick={() => handleSequenceClick(sequence)}
              className="cursor-pointer rounded-lg bg-white/5 p-4 transition-colors hover:bg-white/10"
              role="button"
              tabIndex={0}
            >
              <p className="text-sm">
                Sequence {sequence.sequenceNumber}
              </p>
              <p className="mt-2 text-gray-300">{sequence.content}</p>
            </div>
          ))}
        </div>
      </div>
      {sequences.length >= 10 && (
        <div className="flex justify-center py-4">
          <button
            onClick={loadMore}
            disabled={isLoading}
            className="rounded-lg bg-white/10 px-4 py-2 text-sm hover:bg-white/20 disabled:opacity-50"
          >
            {isLoading ? 'Loading...' : 'Load More'}
          </button>
        </div>
      )}
    </div>
  );
} 