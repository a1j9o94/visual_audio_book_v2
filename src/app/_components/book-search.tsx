'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function BookSearch() {
  const [query, setQuery] = useState('');
  const router = useRouter();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/?q=${encodeURIComponent(query)}`);
    }
  };

  return (
    <form onSubmit={handleSearch} className="mb-8">
      <div className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search for books..."
          className="flex-1 rounded-lg bg-white/10 px-4 py-2 text-white"
        />
        <button
          type="submit"
          className="rounded-lg bg-white/10 px-4 py-2 font-semibold text-white hover:bg-white/20"
        >
          Search
        </button>
      </div>
    </form>
  );
} 