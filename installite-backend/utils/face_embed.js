// utils/face_embed.js

/**
 * Stubbed face embedding generator:
 *   - Avoids tfjs-native entirely
 *   - Returns a deterministic 128-vector based on the file buffer
 */
export async function generateFaceEmbedding(buffer) {
  const embedding = new Array(128);
  for (let i = 0; i < 128; i++) {
    // simple pseudo-random from the buffer bytes
    embedding[i] = (buffer[i % buffer.length] ?? 0) / 255;
  }
  return embedding;
}