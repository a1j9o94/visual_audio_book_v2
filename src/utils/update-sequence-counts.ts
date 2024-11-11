import 'dotenv/config';
import { db } from "~/server/db";
import { books, sequences } from "~/server/db/schema";
import { eq, and } from "drizzle-orm";
import { sql } from "drizzle-orm";

async function updateSequenceCounts() {
  try {
    console.log("Starting sequence count update process...");

    // Get all books
    const allBooks = await db.query.books.findMany();
    console.log(`Found ${allBooks.length} books to process`);

    let updatedCount = 0;

    for (const book of allBooks) {
      console.log(`Processing "${book.title}"...`);

      // Count completed sequences for this book
      const result = await db
        .select({
          count: sql<number>`cast(count(*) as integer)`
        })
        .from(sequences)
        .where(
          and(
            eq(sequences.bookId, book.id),
            eq(sequences.status, 'completed')
          )
        );

      const completedCount = result[0]?.count ?? 0;

      // Update the book with the count
      await db
        .update(books)
        .set({ 
          completedSequenceCount: completedCount 
        })
        .where(eq(books.id, book.id));

      console.log(`✅ Updated "${book.title}" with ${completedCount} completed sequences`);
      updatedCount++;
    }

    console.log("\nUpdate complete!");
    console.log(`Updated ${updatedCount} books`);

  } catch (error) {
    console.error("Error updating sequence counts:", error);
  } finally {
    process.exit(0);
  }
}

// Run the script
void updateSequenceCounts();
