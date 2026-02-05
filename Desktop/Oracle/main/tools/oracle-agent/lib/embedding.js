/**
 * Embedding Generation for Semantic Search
 * Uses OpenAI text-embedding-3-small (cheap & fast)
 */

import OpenAI from 'openai';

let openai = null;

function getOpenAI() {
  if (!openai && process.env.OPENAI_API_KEY) {
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openai;
}

/**
 * Generate embedding vector for text
 * @param {string} text - Text to embed
 * @returns {number[]|null} - 1536-dimensional vector or null
 */
export async function generateEmbedding(text) {
  const client = getOpenAI();

  if (!client) {
    return null;
  }

  try {
    const response = await client.embeddings.create({
      model: 'text-embedding-3-small',
      input: text.slice(0, 8000), // Limit input size
      dimensions: 1536
    });

    return `[${response.data[0].embedding.join(',')}]`;
  } catch (error) {
    console.error('[Embedding] Generation failed:', error.message);
    return null;
  }
}

/**
 * Calculate cosine similarity between two vectors
 */
export function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) return 0;

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

export default { generateEmbedding, cosineSimilarity };
