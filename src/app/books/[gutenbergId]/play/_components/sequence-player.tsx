'use client';

import { useState, useEffect, useRef } from 'react';

import type { TouchEvent } from 'react';
import Image from 'next/image';
import { api } from "~/trpc/react";
import { useRouter } from 'next/navigation';
import type { inferProcedureOutput } from '@trpc/server';
import type { AppRouter } from '~/server/api/root';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface SequencePlayerProps {
  sequences: inferProcedureOutput<AppRouter['sequence']['getByBookId']>;
  totalSequences: number;
  initialSequence: number;
  gutenbergId: string;
  bookId: string;
}

export function SequencePlayer({ sequences: initialSequences, initialSequence, gutenbergId, totalSequences, bookId }: SequencePlayerProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [sequences, setSequences] = useState(initialSequences);
  const currentSequence = sequences[currentIndex];
  const router = useRouter();
  const media = api.sequence.getSequenceMedia.useQuery(currentSequence?.id ?? '');
  const updateProgress = api.sequence.updateProgress.useMutation();

  // Add logging when sequences change
  useEffect(() => {
    console.log('Sequences updated:', {
      totalSequences,
      currentLength: sequences.length,
      currentIndex,
      sequenceNumbers: sequences.map(s => s.sequenceNumber)
    });
  }, [sequences, currentIndex, totalSequences]);

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

  useEffect(() => {
    // When we're 3 sequences away from the end, fetch more
    if (currentIndex >= sequences.length - 3 && sequences.length < totalSequences) {
      console.log('Attempting to fetch more sequences:', {
        currentIndex,
        sequencesLength: sequences.length,
        totalSequences,
        startingFrom: sequences.length
      });
      
      void fetchMoreSequences.refetch().then((result) => {
        if (result.data) {
          console.log('New sequences fetched:', {
            count: result.data.length,
            newSequenceNumbers: result.data.map(s => s.sequenceNumber)
          });
          setSequences(prev => {
            const newSequences = [...prev, ...result.data];
            console.log('Updated sequences array:', {
              oldLength: prev.length,
              newLength: newSequences.length,
              allSequenceNumbers: newSequences.map(s => s.sequenceNumber)
            });
            return newSequences;
          });
        }
      });
    }
  }, [currentIndex, sequences.length, totalSequences, fetchMoreSequences]);

  // Modify the initial position effect to include logging
  const hasSetInitialPosition = useRef(false);
  useEffect(() => {
    console.log('Initial position effect running:', {
      hasSetInitialPosition: hasSetInitialPosition.current,
      initialSequence,
      currentSequences: sequences.map(s => s.sequenceNumber)
    });
    
    if (!hasSetInitialPosition.current) {
      const startIndex = sequences.findIndex(seq => 
        seq.sequenceNumber >= initialSequence
      );
      console.log('Found start index:', {
        startIndex,
        initialSequence,
        matchedSequenceNumber: startIndex !== -1 ? sequences[startIndex]?.sequenceNumber : null
      });
      
      if (startIndex !== -1) {
        setCurrentIndex(startIndex);
      }
      hasSetInitialPosition.current = true;
    }
  }, [sequences, initialSequence]);

  useEffect(() => {
    if (!audioRef.current) return;

    const audio = audioRef.current;

    const handleEnded = () => {
      console.log('Audio ended:', {
        currentIndex,
        sequencesLength: sequences.length,
        nextIndex: currentIndex + 1,
        currentSequenceNumber: sequences[currentIndex]?.sequenceNumber,
        nextSequenceNumber: sequences[currentIndex + 1]?.sequenceNumber
      });
      
      if (currentIndex < sequences.length - 1) {
        setCurrentIndex(prev => prev + 1);
      } else if (currentIndex === sequences.length - 1) {
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
      }
    };

    const handleTimeUpdate = () => {
      if (!audio || !bookId || !currentSequence) return;
      
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

  // Touch handling state
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const minSwipeDistance = 50;

  // Touch handlers
  const onTouchStart = (e: TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0]?.clientY ?? null);
  };

  const onTouchMove = (e: TouchEvent) => {
    setTouchEnd(e.targetTouches[0]?.clientY ?? null);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    
    const distance = touchStart - touchEnd;
    const isUpSwipe = distance > minSwipeDistance;
    const isDownSwipe = distance < -minSwipeDistance;
    
    if (isUpSwipe && currentIndex < sequences.length - 1) {
      setCurrentIndex(prev => prev + 1);
    }
    if (isDownSwipe && currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
    
    setTouchStart(null);
    setTouchEnd(null);
  };

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

  // Add this new effect after the other useEffects
  useEffect(() => {
    // When sequence changes, ensure audio starts playing
    if (audioRef.current) {
      void audioRef.current.play().catch(() => {
        // Handle autoplay restrictions if needed
        console.log('Autoplay prevented by browser');
      });
      setIsPlaying(true);
    }
  }, [currentIndex]);

  if (!currentSequence?.id || !media.data) {
    return null;
  }

  return (
    <div className="relative flex h-full flex-col items-center justify-center">
      {/* Image Container - Full screen on mobile */}
      <div 
        className="relative h-full w-full cursor-pointer"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onClick={togglePlayPause}
      >
        {media.data.imageUrl && (
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
                  togglePlayPause();
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
      {media.data.audioUrl && (
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
