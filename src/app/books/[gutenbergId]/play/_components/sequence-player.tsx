'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { api } from "~/trpc/react";
import { useRouter } from 'next/navigation';

interface Sequence {
  id: string;
  sequenceNumber: number;
  content: string;
  media: {
    audioUrl: string;
    imageUrl: string;
  };
}

interface SequencePlayerProps {
  sequences: Sequence[];
  initialSequence: number;
  gutenbergId: string;
}

export function SequencePlayer({ sequences, initialSequence, gutenbergId }: SequencePlayerProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const audioRef = useRef<HTMLAudioElement>(null);
  const currentSequence = sequences[currentIndex];
  const router = useRouter();

  const updateProgress = api.sequence.updateProgress.useMutation();

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

    // eslint-disable-next-line react-hooks/exhaustive-deps
    const audio = audioRef.current;

    const handleEnded = () => {
      if (currentIndex < sequences.length - 1) {
        setCurrentIndex(prev => prev + 1);
      }
    };

    const handleTimeUpdate = () => {
      if (!audio || !gutenbergId) return;

      if (currentIndex >= sequences.length - 1 && audio.currentTime >= audio.duration - 0.1) {
        // Save final progress and redirect

        //check if sequenceId exists
        if(!sequences[sequences.length - 1]?.id) {
          throw new Error('Sequence ID not found');
        }
        updateProgress.mutate({
          sequenceId: sequences[sequences.length - 1]?.id,
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
  }, [currentIndex, sequences.length, currentSequence.id, updateProgress]);

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

  return (
    <div className="relative flex h-full flex-col items-center justify-center">
      {currentSequence.media.imageUrl && (
        <div className="relative aspect-video w-full overflow-hidden rounded-lg">
          <Image
            src={currentSequence.media.imageUrl}
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
          src={currentSequence.media.audioUrl}
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
