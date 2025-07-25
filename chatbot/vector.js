import { Document } from "@langchain/core/documents";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { OpenAIEmbeddings } from "@langchain/openai";
import { Chroma } from "@langchain/community/vectorstores/chroma";
import { get_db_connection } from "../server/models/rdbms.js";

// using a retriever as was done in Lecture 17
let retriever = null;

/*initializing the retriever, where textChunks is an array of movie and actor blurbs
(hardcoded from chatbot.js as of right now)*/
/*the point of this function is to convert the string to langchain, then use a splitter as in lecture 17,
then generate the embeddings, then store this in a memory vector store*/
export async function createRetrieverFromDatabase() {
    const db = await get_db_connection();
    await db.connect();

  const [rows] = await db.send_sql(`
    SELECT n.primaryName, p.category, p.job, t.primaryTitle, t.startYear
    FROM principals p
    JOIN names n ON p.nconst = n.nconst
    JOIN titles t ON p.tconst = t.tconst
    WHERE p.category IN ('actor', 'actress', 'director')
    LIMIT 500;
  `);
  
    const textChunks = rows.map(row => {
      const role = row.category === 'director'
        ? `${row.primaryName} directed the movie ${row.primaryTitle} (${row.startYear})`
        : `${row.primaryName} played the role of ${row.job || 'unknown role'} in the movie ${row.primaryTitle} (${row.startYear})`;
      return role;
    });
  
    const docs = textChunks.map(text => new Document({ pageContent: text }));
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 300,
      chunkOverlap: 30
    });
    const splitDocs = await splitter.splitDocuments(docs);
    const embeddings = new OpenAIEmbeddings({ modelName: "text-embedding-3-small" });
  
    const vectorStore = await Chroma.fromDocuments(splitDocs, embeddings, {
      collectionName: "actor_movie_roles",
      url: "http://localhost:8000"
    });
  
    retriever = vectorStore.asRetriever();
    console.log("Retriever created and initialized with Chroma vector store.");
}


export async function retrieveRelevantDocs(query) {
  if (!retriever) {
    throw new Error("Retriever not initialized. Call createRetriever() first.");
  }
  return await retriever.getRelevantDocuments(query); 
  /*using k=5 as the image topK algorithm in the app gives out the top 5 actor matches*/
}
