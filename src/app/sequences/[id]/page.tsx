import { api } from "~/trpc/server";
import { notFound } from "next/navigation";
import Image from "next/image";
import { AudioPlayer } from "../../books/[id]/[sequence_number]/_components/AudioPlayer";
import { type Metadata } from "next";

type Props = {
  params: {
    id: string;
  };
};

export default async function SequencePage({ params }: Props) {
  try {
    const sequence = await api.sequence.getById(params.id);

    if (!sequence) {
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
      </main>
    );
  } catch (error) {
    console.error(error);
    notFound();
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  try {
    const sequence = await api.sequence.getById(params.id);
    return {
      title: `Sequence ${sequence?.sequenceNumber ?? 'Not Found'}`,
      description: sequence?.content?.slice(0, 160),
    };
  } catch {
    return {
      title: 'Sequence Not Found',
      description: 'The requested sequence could not be found',
    };
  }
} 