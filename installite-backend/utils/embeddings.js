// utils/embeddings.js

export async function generateEmbedding(bufferOrPath) {
  // Simulate generating a 128-dimensional embedding
  const embedding = Array.from({ length: 128 }, () => Math.random());
  console.log('Generated embedding for:', typeof bufferOrPath === 'string' ? bufferOrPath : 'buffer');
  return embedding;
}