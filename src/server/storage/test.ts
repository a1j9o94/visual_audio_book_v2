import 'dotenv/config';
import { getMediaStorage } from './index';
import { db } from '~/server/db';
import { sequenceMedia, sequences, books } from '~/server/db/schema';
import { eq } from 'drizzle-orm';
import fs from 'fs/promises';
import path from 'path';

async function testStorage() {
  const mockSequenceId = 'mock-sequence-123';
  const testBookId = 'test-book-123';
  
  // Load test files from the test-files directory
  const audioBuffer = await fs.readFile(path.join(process.cwd(), 'src', 'server', 'storage', 'test-files', 'test.mp3'));
  const imageBuffer = await fs.readFile(path.join(process.cwd(), 'src', 'server', 'storage', 'test-files', 'test.png'));

  try {
    console.log('Testing storage implementation...');
    console.log('Environment:', process.env.NODE_ENV);
    
    // Create test book first
    const [book] = await db.insert(books).values({
      id: testBookId,
      title: "Test Book",
      author: "Test Author",
      status: "pending"
    }).returning();

    if (!book) {
      throw new Error('Failed to create test book');
    }
    
    // Create single test sequence for both media types
    const [sequence] = await db.insert(sequences).values({
      id: mockSequenceId,
      bookId: testBookId,
      sequenceNumber: 1,
      content: "Test content for both audio and image",
      startPosition: 0,
      endPosition: 100,
      status: "pending"
    }).returning();

    if (!sequence) {
      throw new Error('Failed to create test sequence');
    }
    
    const storage = getMediaStorage();
    
    // Test programmatic audio upload
    console.log('Testing audio upload...');
    const audioUrl = await storage.saveAudio(testBookId, mockSequenceId, audioBuffer);
    console.log('Audio uploaded:', audioUrl);
    
    // Add a small delay to ensure database writes are complete
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Verify audio URL is retrievable
    const retrievedAudioUrl = await storage.getAudioUrl(mockSequenceId);
    console.log('Audio URL retrieved:', retrievedAudioUrl);
    
    // Test programmatic image upload
    console.log('Testing image upload...');
    const imageUrl = await storage.saveImage(testBookId, mockSequenceId, imageBuffer);
    console.log('Image uploaded:', imageUrl);
    
    // Add a small delay to ensure database writes are complete
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Verify image URL is retrievable
    const retrievedImageUrl = await storage.getImageUrl(mockSequenceId);
    console.log('Image URL retrieved:', retrievedImageUrl);

  } catch (error) {
    console.error('Test failed:', error);
    throw error;
  } finally {
    // Clean up database entries in correct order
    await db.delete(sequenceMedia)
      .where(eq(sequenceMedia.sequenceId, mockSequenceId));
    await db.delete(sequences)
      .where(eq(sequences.id, mockSequenceId));
    await db.delete(books)
      .where(eq(books.id, testBookId));
    
    console.log('Test cleanup completed');
  }
}

// Run the test
void testStorage()
  .then(() => {
    console.log('All storage tests completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Storage tests failed:', error);
    process.exit(1);
  }); 