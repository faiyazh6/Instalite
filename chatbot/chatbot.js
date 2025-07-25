// chatbot/chatbot.js
import * as dotenv from "dotenv";
dotenv.config();

import { ChatOpenAI } from "@langchain/openai";
import { PromptTemplate } from "@langchain/core/prompts";
import {
  retrieveRelevantDocs,
  ensureRetrieversReady
} from "../installite-backend/utils/vector.js";
import {
  searchUsersByQuery,
  searchPostsByQuery
} from "../server/models/rag_helpers.js";

const template = `
Answer the question based on the following context:

Context:
{context}

Question:
{question}

Answer:
`;

const prompt = new PromptTemplate({
  template,
  inputVariables: ["context", "question"]
});

const model = new ChatOpenAI({
  modelName: "gpt-4.1-nano",
  temperature: 0.7
});

export async function callChatbot(query) {
  await ensureRetrieversReady();

  // 1. Retrieve vector-based documents
  const docs = await retrieveRelevantDocs(query);
  const vectorText = docs.map(d => d.pageContent).join("\n\n");

  // 2. Retrieve SQL matches
  const [users, posts] = await Promise.all([
    searchUsersByQuery(query),
    searchPostsByQuery(query)
  ]);

  const userText = users.length
    ? "Matched Users:\n" + users.map(u => `• ${u.username}`).join("\n")
    : "";

  const postText = posts.length
    ? "Matched Posts:\n" + posts.map(p => `• ${p.text_content}`).join("\n")
    : "";

  // 3. Combine everything into the context string
  const context = [vectorText, userText, postText]
    .filter(part => part.trim().length > 0)
    .join("\n\n");

  // 4. Format prompt and query model
  const filledPrompt = await prompt.format({ context, question: query });
  const response = await model.call([{ role: "user", content: filledPrompt }]);

  return {
    answer: response.text,
    matchedUsers: users,
    matchedPosts: posts
  };  
}

/* Optional: local testing only
async function testChatbot() {
  const answer = await callChatbot("Who directed Cinderella?");
  console.log("Answer:", answer);
}

testChatbot();*/