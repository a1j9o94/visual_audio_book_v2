'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { api } from "~/trpc/react";
import { useRouter } from 'next/navigation';
import type { inferProcedureOutput } from '@trpc/server';
import type { AppRouter } from '~/server/api/root';

interface SequencePlayerProps {
  sequences: inferProcedureOutput<AppRouter['sequence']['getByBookId']>;
  totalSequences: number;
  initialSequence: number;
  gutenbergId: string;
  bookId: string;
}

export function SequencePlayer({ sequences, initialSequence, gutenbergId, totalSequences, bookId }: SequencePlayerProps) {
  console.log(`Sequence player for ${bookId} with ${totalSequences} sequences`);
  const utils = api.useUtils();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const audioRef = useRef<HTMLAudioElement>(null);
  const currentSequence = sequences[currentIndex];
  const router = useRouter();
  const media = api.sequence.getSequenceMedia.useQuery(currentSequence?.id ?? '');
  const updateProgress = api.sequence.updateProgress.useMutation();

  // Move all hooks to the top, before any conditional returns
  useEffect(() => {
    // Prefetch next 5 sequences
    const nextSequences = sequences.slice(
      currentIndex + 1,
      currentIndex + 6
    );
    
    nextSequences.forEach((sequence) => {
      void utils.sequence.getSequenceMedia.prefetch(sequence.id);
    });
  }, [currentIndex, sequences, utils.sequence.getSequenceMedia]);

  useEffect(() => {
    // Find the starting index based on initialSequence
    const startIndex = sequences.findIndex(seq => 
      seq.sequenceNumber >= initialSequence
    );
    if (startIndex !== -1) {
      setCurrentIndex(startIndex);
    }
  }, [sequences, initialSequence]);

  useEffect(() => {
    if (!audioRef.current) return;

    const audio = audioRef.current;

    const handleEnded = () => {
      if (currentIndex < sequences.length - 1) {
        setCurrentIndex(prev => prev + 1);
      }
    };

    const handleTimeUpdate = () => {
      if (!audio || !bookId || !currentSequence) return;

      if (currentIndex >= sequences.length - 1 && audio.currentTime >= audio.duration - 0.1) {
        const lastSequence = sequences[sequences.length - 1];
        if (!lastSequence?.id) {
          throw new Error('Sequence ID not found');
        }
        
        updateProgress.mutate({
          bookId: bookId,
          sequenceId: lastSequence.id,
          timeSpent: Math.floor(audio.duration),
          completed: true
        }, {
          onSuccess: () => {
            router.push(`/books/${gutenbergId}`);
          }
        });
        return;
      }
      
      updateProgress.mutate({
        bookId: bookId,
        sequenceId: currentSequence.id,
        timeSpent: Math.floor(audio.currentTime),
        completed: false
      });
    };

    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('timeupdate', handleTimeUpdate);

    return () => {
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
    };
  }, [currentIndex, sequences.length, currentSequence?.id, gutenbergId, router, sequences, currentSequence, updateProgress, bookId]);

  const togglePlayPause = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        void audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  if (!currentSequence?.id) {
    return null;
  }
  if (!media.data) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-gray-400">No media found for this sequence.</p>
      </div>
    );
  }

  return (
    <div className="relative flex h-full flex-col items-center justify-center">
      {media.data.imageUrl && (
        <div className="relative aspect-video w-full overflow-hidden rounded-lg">
          <Image
            src={media.data.imageUrl}
            alt={`Sequence ${currentSequence.sequenceNumber}`}
            fill
            className="object-cover"
            priority
            sizes="(min-width: 768px) 100vw, 100vw"
          />
        </div>
      )}

      <div className="mt-4 w-full">
        <p className="mb-4 text-center text-gray-200">
          {currentSequence.content}
        </p>

        <audio
          ref={audioRef}
          src={media.data.audioUrl ?? undefined}
          autoPlay={isPlaying}
          className="w-full"
          controls
        />

        <div className="mt-4 flex justify-center gap-4">
          <button
            onClick={() => currentIndex > 0 && setCurrentIndex(prev => prev - 1)}
            className="rounded-lg bg-white/10 px-4 py-2 hover:bg-white/20"
            disabled={currentIndex === 0}
          >
            Previous
          </button>
          <button
            onClick={togglePlayPause}
            className="rounded-lg bg-white/10 px-4 py-2 hover:bg-white/20"
          >
            {isPlaying ? 'Pause' : 'Play'}
          </button>
          <button
            onClick={() => currentIndex < sequences.length - 1 && setCurrentIndex(prev => prev + 1)}
            className="rounded-lg bg-white/10 px-4 py-2 hover:bg-white/20"
            disabled={currentIndex === sequences.length - 1}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
