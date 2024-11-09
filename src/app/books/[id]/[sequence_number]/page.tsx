import { api } from "~/trpc/server";
import { notFound } from "next/navigation";
import Image from "next/image";
import { AudioPlayer } from "./_components/AudioPlayer";
import { type Metadata } from "next";
import { auth } from "~/server/auth";

type Params = Promise<{
  id: string;
  sequence_number: string;
}>;

type PageProps = {
  params: Params;
};

type SafeSequence = {
  id: string;
  sequenceNumber: number;
  content: string;
  media: {
    imageUrl: string | null;
    audioUrl: string | null;
  } | null;
};

export default async function BookSequencePage({ params }: PageProps) {
  const session = await auth();
  if (!session) {
    notFound();
  }

  try {
    const { id, sequence_number } = await params;
    const sequenceNumber = parseInt(sequence_number, 10);

    if (!id || isNaN(sequenceNumber)) {
      notFound();
    }

    const sequence = (await api.sequence.getByBookIdAndNumber({
      bookId: id,
      sequenceNumber,
    })) as SafeSequence;

    if (!sequence?.media) {
      notFound();
    }

    const imageUrl = sequence.media.imageUrl ?? null;
    const audioUrl = sequence.media.audioUrl ?? null;

    return (
      <main className="flex min-h-screen flex-col bg-gradient-to-b from-[#2e026d] to-[#15162c] text-white">
        <div className="container mx-auto px-4 py-16">
          <div className="flex flex-col gap-8">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-bold">
                Sequence {sequence.sequenceNumber}
              </h1>
            </div>

            {imageUrl && (
              <div className="relative aspect-video w-full overflow-hidden rounded-lg">
                <Image
                  src={imageUrl}
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

            {audioUrl && (
              <div className="rounded-lg bg-white/5 p-6">
                <AudioPlayer audioUrl={audioUrl} />
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
