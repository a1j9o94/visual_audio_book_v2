'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { api } from "~/trpc/react";
import { useRouter } from 'next/navigation';
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
  const audioRef = useRef<HTMLAudioElement>(null);
  const [sequences, setSequences] = useState(initialSequences);
  const currentSequence = sequences[currentIndex];
  const router = useRouter();
  const media = api.sequence.getSequenceMedia.useQuery(currentSequence?.id ?? '');
  const updateProgress = api.sequence.updateProgress.useMutation();
  const processSequences = api.sequence.processSequences.useMutation();

  // Touch handling state
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  const fetchMoreSequences = api.sequence.getByBookId.useQuery(
    {
      bookId,
      startSequence: sequences.length,
      numberOfSequences: 10
    },
    {
      enabled: false
    }
  );

  // Initial loading and position setup
  useEffect(() => {
    const initialize = async () => {
      setIsLoading(true);
      
      // Prefetch first 5 sequences
      const initialBatch = sequences.slice(0, 5);
      await Promise.all(
        initialBatch.map(seq => utils.sequence.getSequenceMedia.prefetch(seq.id))
      );

      // Set initial position
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

  // Prefetch next sequences and process more if needed
  useEffect(() => {
    // Prefetch next 5 sequences
    const nextSequences = sequences.slice(
      currentIndex + 1,
      currentIndex + 6
    );
    
    nextSequences.forEach((sequence) => {
      void utils.sequence.getSequenceMedia.prefetch(sequence.id);
    });

    // Process more sequences if needed
    const lastSequenceNumber = sequences[sequences.length - 1]?.sequenceNumber ?? 0;
    if (currentIndex >= sequences.length - 5 && lastSequenceNumber < totalSequences) {
      void processSequences.mutate({
        bookId,
        gutenbergId,
        numSequences: 10,
      });
    }
  }, [
    currentIndex, 
    sequences, 
    utils.sequence.getSequenceMedia, 
    processSequences, 
    bookId, 
    gutenbergId, 
    totalSequences
  ]);

  // Fetch more sequences when needed
  useEffect(() => {
    if (currentIndex >= sequences.length - 3 && sequences.length < totalSequences) {
      void fetchMoreSequences.refetch().then((result) => {
        if (result.data) {
          setSequences(prev => [...prev, ...result.data]);
        }
      });
    }
  }, [currentIndex, sequences.length, totalSequences, fetchMoreSequences]);

  // Audio handling
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
        if (!lastSequence?.id) return;
        
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
  }, [currentIndex, sequences, currentSequence?.id, gutenbergId, router, updateProgress, bookId, currentSequence]);

  // Touch handlers
  const handleTouchStart = (e: TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0]?.clientY ?? null);
  };

  const handleTouchMove = (e: TouchEvent) => {
    setTouchEnd(e.targetTouches[0]?.clientY ?? null);
  };

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    
    const distance = touchStart - touchEnd;
    const isUpSwipe = distance > 50;
    const isDownSwipe = distance < -50;
    
    if (isUpSwipe && currentIndex < sequences.length - 1) {
      setCurrentIndex(prev => prev + 1);
    }
    if (isDownSwipe && currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
    
    setTouchStart(null);
    setTouchEnd(null);
  };

  const handlePlayPause = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        void audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-white" />
          <p className="text-white">Loading your story...</p>
        </div>
      </div>
    );
  }

  if (!currentSequence?.id || !media.data) {
    return null;
  }

  return (
    <div className="relative flex h-full flex-col items-center justify-center">
      <div 
        className="relative h-full w-full cursor-pointer"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={handlePlayPause}
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
        
        {/* Desktop Navigation Buttons */}
        <div className="pointer-events-none absolute bottom-8 left-0 right-0 hidden items-center justify-between px-[20%] md:flex">
          {currentIndex > 0 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (currentIndex > 0) setCurrentIndex(prev => prev - 1);
              }}
              className="pointer-events-auto rounded-full bg-black/50 p-6 text-white backdrop-blur-sm transition-colors hover:bg-black/60"
              aria-label="Previous sequence"
              title="Previous sequence"
            >
              <ChevronLeft className="h-8 w-8" />
            </button>
          )}
          {currentIndex < sequences.length - 1 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (currentIndex < sequences.length - 1) setCurrentIndex(prev => prev + 1);
              }}
              className="pointer-events-auto rounded-full bg-black/50 p-6 text-white backdrop-blur-sm transition-colors hover:bg-black/60"
              aria-label="Next sequence"
              title="Next sequence"
            >
              <ChevronRight className="h-8 w-8" />
            </button>
          )}
        </div>
        
        {/* Play/Pause Indicator */}
        <div 
          className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-black/50 p-4 backdrop-blur-sm transition-opacity duration-200 md:hidden ${
            isPlaying ? 'opacity-0' : 'opacity-100'
          }`}
        >
          <div className="h-8 w-8 text-white">
            {isPlaying ? '⏸️' : '▶️'}
          </div>
        </div>
        
        {/* Text Overlay - Only on mobile */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 md:hidden">
          <p className="text-center text-sm text-white">
            {currentSequence.content}
          </p>
        </div>

        {/* Desktop Content */}
        <div className="hidden md:block md:w-full">
          <div className="mt-4 w-full">
            <p className="mb-4 text-center text-gray-200">
              {currentSequence.content}
            </p>

            <div className="mt-4 flex justify-center gap-4">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handlePlayPause();
                }}
                className="rounded-lg bg-white/10 px-4 py-2 hover:bg-white/20"
              >
                {isPlaying ? 'Pause' : 'Play'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Single audio element for both mobile and desktop */}
      {media.data?.audioUrl && (
        <audio
          ref={audioRef}
          src={media.data.audioUrl}
          autoPlay={isPlaying}
          className={`${!isPlaying ? 'hidden' : ''} md:block md:w-full`}
          controls={false}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
        />
      )}
    </div>
  );
}
