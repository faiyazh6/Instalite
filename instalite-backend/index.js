// instalite-backend/index.js
import express from 'express';
import http from 'http';
import registerRoutes from './routes/registerRoutes.js';
import { initChatModule } from '../server/chat/chat.js'; 
import { initSocketServer } from '../server/chat/websocket.js';
import { createRetrieverFromDatabase } from '../chatbot/vector.js';
import cors from 'cors';
import session from 'express-session';
import dotenv from 'dotenv';
dotenv.config();

import path from "path";
import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

async function startServer() {
  await initChatModule();
  const app = express();

  app.use(express.static(path.join(__dirname, "public")));

  app.use(
    "/uploads",
    express.static(path.join(__dirname, "..", "uploads"))
  );

  app.use(
    cors({
      origin: 'http://localhost:3001',
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
      credentials: true
    })
  );

  app.use(express.json());
  app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false,
      httpOnly: true,
      maxAge: 1000 * 60 * 60
    }
  }));  
  registerRoutes(app);

  // ---------- SOCKET.IO ----------
  const httpServer = http.createServer(app);
  initSocketServer(httpServer);          // spin up socket.io on port 3030
  // --------------------------------

  await createRetrieverFromDatabase().catch(err => {
    console.error('Retriever init failed:', err);
    process.exit(1);
  });

  const PORT = process.env.PORT || 3030;
  httpServer.listen(PORT, () => {
    console.log(`API & Socket.io listening on http://localhost:${PORT}`);
  });
}

startServer();