// utils/vector.js

import dotenv from 'dotenv';
dotenv.config();

import { ChromaClient } from 'chromadb';
import { Chroma } from "@langchain/community/vectorstores/chroma";
import { Document } from "@langchain/core/documents";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import * as OpenAIModule from "@langchain/openai";
import { VectorStoreRetriever } from "@langchain/core/vectorstores";

const OpenAIEmbeddings = OpenAIModule.OpenAIEmbeddings;
import { get_db_connection } from '../../server/models/rdbms.js';

// ─────────────────────────────────────────────────────────────────────────────
// FACE-MATCHING (profile selfies → actor profiles) via low-level ChromaClient
// ─────────────────────────────────────────────────────────────────────────────

const client = new ChromaClient({
  path: process.env.CHROMA_URL || 'http://localhost:8000'
});
const FACE_COLLECTION = 'actors';
let faceCollection = null;

async function ensureFaceCollectionExists() {
  if (faceCollection) return faceCollection;
  try {
    faceCollection = await client.getCollection({ name: FACE_COLLECTION });
    console.log(`Reusing existing collection "${FACE_COLLECTION}"`);
  } catch {
    console.log(`Collection "${FACE_COLLECTION}" not found; creating it...`);
    faceCollection = await client.createCollection({ name: FACE_COLLECTION });
    console.log(`Created collection "${FACE_COLLECTION}"`);
  }
  return faceCollection;
}

export async function storeUserEmbedding(userId, embedding) {
  const coll = await ensureFaceCollectionExists();
  await coll.add({
    ids: [userId],
    embeddings: [embedding],
  });
  console.log(`Stored embedding for user ${userId}`);
}

export async function getTopFaceMatches(userId, embedding, n = 5) {
  const coll = await ensureFaceCollectionExists();
  // grab a few more in case we need to drop some
  const { ids, distances, metadatas } = await coll.query({
    queryEmbeddings: [embedding],
    nResults: n + 2,              // ask for 2 extra
    include: ['distances','metadatas'],
  });

  // zip into an array of {nconst, name, imageUrl, distance}
  const matches = ids[0].map((id, i) => ({
    nconst:   id,
    name:     metadatas[0][i]?.name,
    imageUrl: metadatas[0][i]?.imageUrl,
    distance: distances[0][i],
  }));

  // drop entries that are “you” (same ID) or distance == 0
  const filtered = matches.filter(m =>
    m.nconst !== userId && m.distance > 0
  );

  // now return exactly n of the remaining
  return filtered.slice(0, n);
}

// ─────────────────────────────────────────────────────────────────────────────
// CHATBOT RETRIEVAL (text embeddings → LangChain retriever → Q&A)
// ─────────────────────────────────────────────────────────────────────────────

let retriever = null;
let reviewRetriever = null;

export async function loadRetrievers() {
  const embeddings = new OpenAIEmbeddings({ modelName: "text-embedding-3-small" });
  const CHROMA_URL = process.env.CHROMA_URL || "http://localhost:8000";

  const actorStore = await Chroma.fromExistingCollection(embeddings, {
    collectionName: "actor_movie_roles",
    url: CHROMA_URL,
  });

  const reviewStore = await Chroma.fromExistingCollection(embeddings, {
    collectionName: "movie_reviews",
    url: CHROMA_URL,
  });

  retriever = new VectorStoreRetriever({
    vectorStore: actorStore,
    searchType: "similarity",
    searchKwargs: { k: 4 },
  });

  reviewRetriever = new VectorStoreRetriever({
    vectorStore: reviewStore,
    searchType: "similarity",
    searchKwargs: { k: 4 },
  });

  console.log("Loaded retrievers from existing Chroma collections (no metadata filtering).");
}

export async function retrieveRelevantDocs(query) {
  if (!retriever || !reviewRetriever) {
    throw new Error("Retrievers not initialized – call `loadRetrievers()` first.");
  }

  let actorDocs = [];
  let reviewDocs = [];

  try {
    actorDocs = await retriever.getRelevantDocuments(query);
  } catch (err) {
    console.warn("Failed to retrieve actor documents:", err.message);
  }

  try {
    reviewDocs = await reviewRetriever.getRelevantDocuments(query);
  } catch (err) {
    console.warn("Failed to retrieve review documents:", err.message);
  }

  return [...actorDocs, ...reviewDocs];
}

let retrieversInitialized = false;

export async function ensureRetrieversReady() {
  if (!retrieversInitialized) {
    console.log("Loading Chroma retrievers...");
    await loadRetrievers();
    retrieversInitialized = true;
  }
}

export const createRetrieverFromDatabase = ensureRetrieversReady;