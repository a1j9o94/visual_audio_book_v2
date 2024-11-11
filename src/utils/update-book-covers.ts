import 'dotenv/config';
import { db } from "~/server/db";
import { books } from "~/server/db/schema";
import { eq, isNull, not } from "drizzle-orm";
import axios from "axios";

async function checkCoverExists(gutenbergId: string): Promise<string | null> {
  const coverUrl = `https://www.gutenberg.org/cache/epub/${gutenbergId}/${gutenbergId}-cover.png`;
  try {
    const response = await axios.head(coverUrl, { timeout: 2000 });
    return response.status === 200 ? coverUrl : null;
  } catch {
    return null;
  }
}

async function updateBookCovers() {
  try {
    console.log("Starting book cover update process...");

    // Get all books that have a gutenbergId
    const allBooks = await db.query.books.findMany({
      where: not(isNull(books.gutenbergId)),
    });

    console.log(`Found ${allBooks.length} books to process`);

    let updatedCount = 0;
    let skippedCount = 0;

    for (const book of allBooks) {
      if (!book.gutenbergId) {
        console.log(`Skipping book "${book.title}" - no Gutenberg ID`);
        skippedCount++;
        continue;
      }

      console.log(`Processing "${book.title}" (${book.gutenbergId})...`);
      
      const coverUrl = await checkCoverExists(book.gutenbergId);
      
      if (coverUrl) {
        await db
          .update(books)
          .set({ coverImageUrl: coverUrl })
          .where(eq(books.id, book.id));
        
        console.log(`✅ Updated cover for "${book.title}"`);
        updatedCount++;
      } else {
        console.log(`❌ No cover found for "${book.title}"`);
        skippedCount++;
      }

      // Add a small delay to avoid overwhelming the Gutenberg server
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log("\nUpdate complete!");
    console.log(`Updated: ${updatedCount} books`);
    console.log(`Skipped: ${skippedCount} books`);

  } catch (error) {
    console.error("Error updating book covers:", error);
  } finally {
    process.exit(0);
  }
}

// Run the script
void updateBookCovers(); 