import 'dotenv/config';
import { ChromaClient } from 'chromadb';
import { Document } from '@langchain/core/documents';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import * as OpenAIModule from '@langchain/openai';
const OpenAIEmbeddings = OpenAIModule.OpenAIEmbeddings;
import { Chroma } from '@langchain/community/vectorstores/chroma';
import { get_db_connection } from '../server/models/rdbms.js';

class WrappedOpenAIEmbeddings extends OpenAIEmbeddings {
  async embedDocuments(texts) {
    return Promise.all(texts.map(text => this.embedQuery(text)));
  }
}
const embeddings = new WrappedOpenAIEmbeddings({ modelName: 'text-embedding-3-small' });

if (typeof embeddings.embedDocuments !== 'function') {
  embeddings.embedDocuments = async function (texts) {
    return Promise.all(texts.map(text => embeddings.embedQuery(text)));
  }.bind(embeddings); // ensure proper `this` binding
}

const client = new ChromaClient({ path: 'http://localhost:8000' });

async function embedTitles() {
  const db = get_db_connection();
  await db.connect();

  const [rows] = await db.send_sql(`
    SELECT n.primaryName, p.category, p.job, t.primaryTitle, t.startYear
    FROM principals p
    JOIN names n ON p.nconst = n.nconst
    JOIN titles t ON p.tconst = t.tconst
    WHERE p.category IN ('actor','actress','director')
    LIMIT 5000;
  `);

  const textChunks = rows.map(r =>
    r.category === 'director'
      ? `${r.primaryName} directed the movie ${r.primaryTitle} (${r.startYear})`
      : `${r.primaryName} played the role of ${r.job || 'unknown role'} in ${r.primaryTitle} (${r.startYear})`
  );

  const docs = textChunks.map((text, i) => new Document({
    pageContent: text,
    metadata: {
      type: 'actor_movie_role',
      actor: rows[i].primaryName,
      title: rows[i].primaryTitle,
      year: rows[i].startYear,
      category: rows[i].category,
      job: rows[i].job || 'unknown'
    }
  }));

  const splitter = new RecursiveCharacterTextSplitter({ chunkSize: 300, chunkOverlap: 30 });
  const splitDocs = await splitter.splitDocuments(docs);

  const actorCollection = await client.getOrCreateCollection({ name: 'actor_movie_roles' });
  const actorStore = new Chroma(actorCollection, embeddings);
  await actorStore.addDocuments(splitDocs);

  console.log('Finished embedding `actor_movie_roles`.');
}

async function embedReviews() {
  const db = get_db_connection();
  await db.connect();

  const [rows] = await db.send_sql(`SELECT review FROM reviews LIMIT 50000;`);

  const docs = rows.map(r => new Document({
    pageContent: r.review,
    metadata: { type: 'review' }
  }));

  const splitter = new RecursiveCharacterTextSplitter({ chunkSize: 500, chunkOverlap: 50 });
  const splitDocs = await splitter.splitDocuments(docs);

  const batchSize = 1000;
  const reviewCollection = await client.getOrCreateCollection({ name: 'movie_reviews' });
  const reviewStore = new Chroma(reviewCollection, embeddings);

  for (let i = 0; i < splitDocs.length; i += batchSize) {
    const batch = splitDocs.slice(i, i + batchSize);
    await reviewStore.addDocuments(batch);
    console.log(`Added batch ${i} to ${i + batchSize}`);
  }

  console.log('Finished embedding `movie_reviews`.');
}

(async function main() {
  try {
    console.log('Starting embedding...');
    await embedTitles();
    await embedReviews();
    console.log('All embeddings complete.');
    process.exit(0);
  } catch (err) {
    console.error('Embedding failed:', err);
    process.exit(1);
  }
})();
