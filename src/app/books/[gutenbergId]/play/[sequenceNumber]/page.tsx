import { redirect } from "next/navigation";
import { api } from "~/trpc/server";
import { notFound } from "next/navigation";

interface PlayPageProps {
  params: Promise<{
    gutenbergId: string;
    sequenceNumber: string;
  }>;
}

export default async function PlayFromSequencePage({ params }: PlayPageProps) {
  // Get the book ID from the Gutenberg ID
  const { gutenbergId, sequenceNumber } = await params;
  const sequenceNumberInt = parseInt(sequenceNumber, 10);

  if (!gutenbergId || isNaN(sequenceNumberInt)) {
    notFound();
  }

  const bookId = await api.book.getBookIdByGutenbergId(gutenbergId);

  if (!bookId) {
    notFound();
  }
  
  // Redirect to the play page with the sequence number in the URL search params
  redirect(`/books/${gutenbergId}/play?startSequence=${sequenceNumber}`);
} 