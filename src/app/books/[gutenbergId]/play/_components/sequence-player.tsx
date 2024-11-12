'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { api } from "~/trpc/react";
import type { inferProcedureOutput } from '@trpc/server';
import type { AppRouter } from '~/server/api/root';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import type { TouchEvent } from 'react';

interface SequencePlayerProps {
  sequences: inferProcedureOutput<AppRouter['sequence']['getByBookId']>;
  totalSequences: number;
  initialSequence: number;
  gutenbergId: string;
  bookId: string;
}

export function SequencePlayer({ sequences: initialSequences, initialSequence, gutenbergId, totalSequences, bookId }: SequencePlayerProps) {
  const utils = api.useUtils();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [hasInteracted, setHasInteracted] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [sequences] = useState(initialSequences);
  const currentSequence = sequences[currentIndex];
  const media = api.sequence.getSequenceMedia.useQuery(currentSequence?.id ?? '');
  const updateProgress = api.sequence.updateProgress.useMutation();
  const processSequences = api.sequence.processSequences.useMutation();

  // Update touch handling state to track Y coordinates instead of X
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  useEffect(() => {
    // Disable scrolling on the body when component mounts
    document.body.style.overflow = 'hidden';
    return () => {
      // Re-enable scrolling when component unmounts
      document.body.style.overflow = 'auto';
    };
  }, []);

  useEffect(() => {
    const initialize = async () => {
      setIsLoading(true);
      const initialBatch = sequences.slice(0, 5);
      await Promise.all(
        initialBatch.map(seq => utils.sequence.getSequenceMedia.prefetch(seq.id))
      );

      const startIndex = sequences.findIndex(seq => 
        seq.sequenceNumber >= initialSequence
      );
      if (startIndex !== -1) {
        setCurrentIndex(startIndex);
      }

      setIsLoading(false);
    };

    void initialize();
  }, [sequences, initialSequence, utils.sequence.getSequenceMedia]);

  useEffect(() => {
    const nextSequences = sequences.slice(
      currentIndex + 1,
      currentIndex + 6
    );
    
    nextSequences.forEach((sequence) => {
      void utils.sequence.getSequenceMedia.prefetch(sequence.id);
    });
  }, [
    currentIndex, 
    sequences, 
    utils.sequence.getSequenceMedia, 
    processSequences, 
    bookId, 
    gutenbergId, 
    totalSequences
  ]);

  // Audio playback and automatic sequence transition
  useEffect(() => {
    if (!audioRef.current || !hasInteracted) return;

    const audio = audioRef.current;

    if (isPlaying) {
      audio.play().catch((e) => console.warn('Autoplay prevented:', e));
    }

    const handleEnded = () => {
      if (currentIndex < sequences.length - 1) {
        setCurrentIndex(prev => prev + 1);
        setIsPlaying(true); // Ensure next audio starts playing
      } else {
        setIsPlaying(false); // Stop if at the end of sequences
      }
    };

    const handleTimeUpdate = () => {
      if (!audio || !bookId || !currentSequence) return;

      updateProgress.mutate({
        bookId: bookId,
        sequenceId: currentSequence.id,
        timeSpent: Math.floor(audio.currentTime),
        completed: audio.currentTime >= audio.duration - 0.1,
      });
    };

    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('timeupdate', handleTimeUpdate);

    return () => {
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
    };
  }, [currentIndex, sequences, currentSequence, isPlaying, hasInteracted, updateProgress, bookId]);

  const handlePlayPause = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play().catch(e => console.warn('Play prevented:', e));
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleStart = () => {
    setHasInteracted(true);
    if (audioRef.current) {
      audioRef.current.play().catch(e => console.warn('Play prevented:', e));
    }
  };

  // Update touch handlers for vertical swipes
  const handleTouchStart = (e: TouchEvent<HTMLDivElement>) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0]?.clientY ?? null);
  };

  const handleTouchMove = (e: TouchEvent<HTMLDivElement>) => {
    setTouchEnd(e.targetTouches[0]?.clientY ?? null);
  };

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    
    const distance = touchStart - touchEnd;
    const minSwipeDistance = 50;
    
    if (Math.abs(distance) < minSwipeDistance) {
      handlePlayPause();
      return;
    }
    
    const isUpSwipe = distance > minSwipeDistance;
    const isDownSwipe = distance < -minSwipeDistance;
    
    if (isUpSwipe && currentIndex < sequences.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setIsPlaying(true);
    }
    if (isDownSwipe && currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
      setIsPlaying(true);
    }
    
    setTouchStart(null);
    setTouchEnd(null);
  };

  if (isLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-white" />
        <p className="text-white">Loading your story...</p>
      </div>
    );
  }

  if (!currentSequence?.id || !media.data) {
    return null;
  }

  return (
    <div className="relative flex h-full flex-col items-center justify-center">
      {!hasInteracted && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black bg-opacity-80">
          <button
            onClick={handleStart}
            className="text-lg font-bold rounded-full px-6"
          >
            Start Listening
          </button>
        </div>
      )}

      <div 
        className="relative h-full w-full cursor-pointer"
        onClick={handlePlayPause}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {media.data?.imageUrl && (
          <Image
            src={media.data.imageUrl}
            alt={`Sequence ${currentSequence.sequenceNumber}`}
            fill
            className="object-cover"
            priority
            sizes="100vw"
          />
        )}
        
        <div className="absolute bottom-8 left-0 right-0 hidden items-center justify-between px-[20%] md:flex">
          {currentIndex > 0 && (
            <button
              type="button"
              title="Previous Sequence"
              onClick={(e) => {
                e.stopPropagation();
                setCurrentIndex(prev => prev - 1);
                setIsPlaying(true); // Ensure audio resumes
              }}
              className="rounded-full bg-black/50 p-6 text-white"
            >
              <ChevronLeft className="h-8 w-8" />
            </button>
          )}
          {currentIndex < sequences.length - 1 && (
            <button
              type="button"
              title="Next Sequence"
              onClick={(e) => {
                e.stopPropagation();
                setCurrentIndex(prev => prev + 1);
                setIsPlaying(true); // Ensure audio resumes
              }}
              className="rounded-full bg-black/50 p-6 text-white"
            >
              <ChevronRight className="h-8 w-8" />
            </button>
          )}
        </div>
        
        <div 
          className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-black/50 p-4 ${isPlaying ? 'opacity-0' : 'opacity-100'}`}
        >
          {isPlaying ? '⏸️' : '▶️'}
        </div>

        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 md:hidden">
          <p className="text-center text-sm text-white">
            {currentSequence.content}
          </p>
        </div>
      </div>

      {media.data?.audioUrl && (
        <audio
          ref={audioRef}
          src={media.data.audioUrl}
          autoPlay={isPlaying && hasInteracted}
          controls={false}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
        />
      )}
    </div>
  );
}