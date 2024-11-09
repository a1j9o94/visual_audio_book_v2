import { api } from "~/trpc/server";
import { notFound } from "next/navigation";
import Image from "next/image";
import { AudioPlayer } from "./_components/AudioPlayer";
import { type Metadata } from "next";

type Params = Promise<{
  id: string;
  sequence_number: string;
}>;

type PageProps = {
  params: Params;
};

// Add type safety for sequence.media access
type SafeSequenceMedia = {
  id: string;
  sequenceId: string | null;
  audioData: string | null;
  imageData: string | null;
  audioDuration: number | null;
  imageMetadata: unknown;
  generatedAt: Date | null;
  audioUrl: string | null;
  imageUrl: string | null;
};

export default async function BookSequencePage({ params }: PageProps) {
  try {
    const { id, sequence_number } = await params;
    
    if(!id || !sequence_number) {
      notFound();
    }

    console.log(`Loading page for book ${id} and sequence ${sequence_number}`);

    const sequenceNumber = parseInt(sequence_number, 10);
    
    
    if (isNaN(sequenceNumber)) {
      console.error('Invalid sequence number:', sequence_number);
      notFound();
    }

    console.log('Parsed sequence number:', sequenceNumber);

    const book = await api.book.getById(id);
    
    if (!book) {
      console.error('Book not found:', id);
      notFound();
    }

    const sequence = await api.sequence.getByBookIdAndNumber({
      bookId: id,
      sequenceNumber,
    });

    if (!sequence) {
      console.error('Sequence not found:', { bookId: id, sequenceNumber });
      notFound();
    }

    // Type assertion for sequence.media
    const media = sequence.media as SafeSequenceMedia | null;

    if (!media) {
      console.log("No media found for sequence", sequence.id);
      notFound();
    }

    if (!media.imageData || !media.audioData) {
      console.log("No media data found for sequence", sequence.id);
      notFound();
    }

    return (
      <main className="flex min-h-screen flex-col bg-gradient-to-b from-[#2e026d] to-[#15162c] text-white">
        <div className="container mx-auto px-4 py-16">
          <div className="flex flex-col gap-8">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-bold">
                Sequence {sequence.sequenceNumber}
              </h1>
            </div>

            {media.imageUrl && (
              <div className="relative aspect-video w-full overflow-hidden rounded-lg">
                <Image
                  src={media.imageUrl}
                  alt={`Sequence ${sequence.sequenceNumber}`}
                  fill
                  className="object-cover"
                  sizes="(min-width: 768px) 100vw, 100vw"
                />
              </div>
            )}

            <div className="rounded-lg bg-white/5 p-6">
              <p className="text-gray-200">{sequence.content}</p>
            </div>

            {media.audioUrl && (
              <div className="rounded-lg bg-white/5 p-6">
                <AudioPlayer audioUrl={media.audioUrl} />
              </div>
            )}
          </div>
        </div>
      </main>
    );
  } catch (error) {
    console.error('Error in BookSequencePage:', error);
    notFound();
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  try {
    const { id, sequence_number } = await params;

    const sequenceNumber = parseInt(sequence_number, 10);
    if (isNaN(sequenceNumber)) {
      return {
        title: 'Invalid Sequence',
        description: 'The sequence number is invalid',
      };
    }

    const sequence = await api.sequence.getByBookIdAndNumber({
      bookId: id,
      sequenceNumber,
    });

    return {
      title: `Sequence ${sequence.sequenceNumber}`,
      description: sequence.content?.slice(0, 160),
    };
  } catch {
    return {
      title: 'Sequence Not Found',
      description: 'The requested sequence could not be found',
    };
  }
}
