import { redirect } from "next/navigation";
import { api } from "~/trpc/server";
import { notFound } from "next/navigation";

interface PageProps {
  params: Promise<{
    gutenbergId: string;
    sequenceNumber: string;
  }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function PlayFromSequencePage({ 
  params,
  searchParams
}: PageProps) {
  console.log('PlayFromSequencePage', params, searchParams);
  const { gutenbergId, sequenceNumber } = await params;
  const sequenceNumberInt = parseInt(sequenceNumber, 10);

  if (!gutenbergId || isNaN(sequenceNumberInt)) {
    notFound();
  }

  const bookId = await api.book.getBookIdByGutenbergId(gutenbergId);
  if (!bookId) {
    notFound();
  }
  
  redirect(`/books/${gutenbergId}/play?startSequence=${sequenceNumber}`);
} 