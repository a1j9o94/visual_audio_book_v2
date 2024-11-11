import OpenAI from 'openai';
import { z } from 'zod';
import { zodResponseFormat } from 'openai/helpers/zod';

const openai = new OpenAI();

const GutenbergMetadataSchema = z.object({
  title: z.string(),
  author: z.string(),
});

export type GutenbergMetadata = z.infer<typeof GutenbergMetadataSchema>;

async function attemptParse(sample: string): Promise<GutenbergMetadata | null> {
  const completion = await openai.beta.chat.completions.parse({
    messages: [
      {
        role: "system",
        content: "You are a precise parser of Project Gutenberg book headers. Extract only the title and author."
      },
      {
        role: "user",
        content: `Extract the book title and author from this Project Gutenberg header text: \n\n${sample}`
      }
    ],
    model: "gpt-4o-2024-08-06",
    response_format: zodResponseFormat(GutenbergMetadataSchema, "extract_metadata"),
  });

  return completion.choices[0]?.message.parsed ?? null;
}

export async function parseGutenbergText(text: string): Promise<GutenbergMetadata | null> {
  // Take first 2000 characters which usually contains the metadata
  const sample = text.slice(0, 2000);
  
  try {
    // First attempt
    const result = await attemptParse(sample);
    if (result) return result;

    // If first attempt fails, wait 1 second and retry once
    console.log('First parsing attempt failed, retrying...');
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Second attempt
    const retryResult = await attemptParse(sample);
    if (retryResult) return retryResult;

    console.error('Both parsing attempts failed');
    return null;

  } catch (error) {
    console.error('Error parsing Gutenberg text:', error);
    return null;
  }
} 