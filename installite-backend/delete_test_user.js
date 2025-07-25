import { ChromaClient } from 'chromadb';

const chroma = new ChromaClient();

const run = async () => {
  const collection = await chroma.getCollection({ name: 'actors' });
  await collection.delete({ ids: ['testUser'] });
  console.log('✅ Deleted testUser from actors collection');
};

run().catch(console.error);