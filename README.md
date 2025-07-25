# InstaLite

InstaLite is an AI-powered social media platform that enables personalized photo sharing, actor face matching, and intelligent chatbot conversations. Built as a full-stack application, it brings together real-time user interactions, cloud storage, and retrieval-augmented AI capabilities.

## Overview

InstaLite allows users to:
- Sign up, upload a profile picture, and receive celebrity face matches using facial recognition.
- Share and browse posts through a real-time feed.
- Interact with an AI-powered chatbot that references user-uploaded documents to provide accurate, context-aware responses.

## Features

- Secure authentication using JWT and bcrypt
- Face matching with 46,000+ actor embeddings using vector search
- Cloud-based image upload and retrieval via AWS S3
- AI chatbot powered by LangChain and document-aware RAG pipeline
- Real-time post feed and user interaction features
- Hashtag-based search and user recommendation system

## Tech Stack

**Frontend**:  
React.js, TailwindCSS, Axios

**Backend**:  
Node.js, Express.js, MySQL, ChromaDB, AWS SDK

**AI and Infrastructure**:  
TensorFlow.js for face embeddings  
LangChain for RAG pipeline  
Kafka for streaming (optional component)

## Face Matching Workflow

1. User uploads a profile photo.
2. The image is uploaded to AWS S3.
3. A facial embedding is generated using a face recognition model.
4. Embedding is compared to a database of actor embeddings stored in ChromaDB.
5. Top matches are returned and displayed on the user profile.

## Chatbot Architecture (RAG)

1. User enters in a question/statement/any form of inquiry.
2. Text is chunked, embedded, and stored in ChromaDB.
3. At query time, LangChain retrieves relevant chunks.
4. A language model generates a context-aware answer based on retrieved content.
