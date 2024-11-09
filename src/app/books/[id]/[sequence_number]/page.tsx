import { api } from "~/trpc/server";
import { notFound } from "next/navigation";
import Image from "next/image";
import { AudioPlayer } from "./_components/AudioPlayer";
import { type Metadata } from "next";

type Props = {
  params: {
    id: string;
    sequence_number: string;
  };
};

export default async function BookSequencePage({ params }: Props) {
  try {
    const { id, sequence_number } = params;
    
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

    return (
      <div className="container mx-auto px-4 py-16">
        <div className="flex flex-col gap-8">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">
              Sequence {sequence.sequenceNumber}
            </h1>
          </div>

          {sequence.media?.imageUrl && (
            <div className="relative aspect-video w-full overflow-hidden rounded-lg">
              <Image
                src={sequence.media.imageUrl}
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

          {sequence.media?.audioUrl && (
            <div className="rounded-lg bg-white/5 p-6">
              <AudioPlayer audioUrl={sequence.media.audioUrl} />
            </div>
          )}
        </div>
      </div>
    );
  } catch (error) {
    console.error('Error in BookSequencePage:', error);
    notFound();
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  try {
    const { id, sequence_number } = params;

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
