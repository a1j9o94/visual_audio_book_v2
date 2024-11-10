'use client';

import { useState } from "react";
import { api } from "~/trpc/react";
import { useRouter } from "next/navigation";

interface RemoveFromLibraryButtonProps {
  bookId: string;
  className?: string;
}

export function RemoveFromLibraryButton({ 
  bookId,
  className = ''
}: RemoveFromLibraryButtonProps) {
  const [isConfirming, setIsConfirming] = useState(false);
  const router = useRouter();
  const utils = api.useUtils();

  const mutation = api.book.removeFromLibrary.useMutation({
    onSuccess: () => {
      void utils.book.getUserLibrary.invalidate();
      void utils.book.getById.invalidate(bookId);
      router.push('/');
      router.refresh();
    },
  });

  const handleClick = () => {
    if (!isConfirming) {
      setIsConfirming(true);
      return;
    }

    mutation.mutate({ bookId });
  };

  const handleCancel = () => {
    setIsConfirming(false);
  };

  if (isConfirming) {
    return (
      <div className={`flex gap-2 ${className}`}>
        <button
          onClick={handleCancel}
          className="flex-1 rounded-lg bg-gray-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-600"
        >
          Cancel
        </button>
        <button
          onClick={handleClick}
          disabled={mutation.isPending}
          className="flex-1 rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-600 disabled:bg-red-400"
        >
          {mutation.isPending ? 'Removing...' : 'Confirm Remove'}
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={handleClick}
      className={`rounded-lg bg-red-500/10 px-4 py-2 text-sm font-medium text-red-500 transition-colors hover:bg-red-500/20 ${className}`}
    >
      Remove from Library
    </button>
  );
} 