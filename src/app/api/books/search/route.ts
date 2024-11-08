import { NextResponse } from "next/server";
import axios from "axios";

interface OpenLibraryBook {
  title: string;
  author_name?: string[];
  id_project_gutenberg?: string[];
  cover_i?: number;
  first_publish_year?: number;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');

  if (!query) {
    return NextResponse.json({ error: 'Search query is required' }, { status: 400 });
  }

  try {
    const searchUrl = `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}`;
    const response = await axios.get<{ docs: OpenLibraryBook[] }>(searchUrl);
    
    const books = response.data.docs.map((book: OpenLibraryBook) => ({
      title: book.title,
      author: book.author_name?.[0] ?? 'Unknown Author',
      gutenbergId: book.id_project_gutenberg?.[0],
      coverId: book.cover_i,
      firstPublishYear: book.first_publish_year,
    })).filter(book => book.gutenbergId); // Only return books with Gutenberg IDs

    return NextResponse.json({ books });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error searching books:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
} 