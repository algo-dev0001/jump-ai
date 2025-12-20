import OpenAI from 'openai';
import { config } from '../config';

const openai = new OpenAI({
  apiKey: config.OPENAI_API_KEY,
});

// Embedding model - text-embedding-3-small is cost-effective and good quality
const EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBEDDING_DIMENSIONS = 1536;

/**
 * Generate embedding for a single text
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  // Truncate if too long (model has 8191 token limit)
  const truncatedText = text.slice(0, 30000); // ~8000 tokens roughly
  
  const response = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: truncatedText,
  });

  return response.data[0].embedding;
}

/**
 * Generate embeddings for multiple texts (batch)
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  
  // Truncate each text
  const truncatedTexts = texts.map((t) => t.slice(0, 30000));
  
  const response = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: truncatedTexts,
  });

  return response.data.map((d) => d.embedding);
}

/**
 * Calculate cosine similarity between two vectors
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

export { EMBEDDING_MODEL, EMBEDDING_DIMENSIONS };

