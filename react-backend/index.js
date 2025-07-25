// instalite-backend/index.js
import express from 'express';
import http from 'http';
import registerRoutes from './routes/registerRoutes.js';
import { initSocketServer } from '../server/chat/websocket.js';
import { createRetrieverFromDatabase } from '../chatbot/vector.js';
import cors from 'cors';

async function startServer() {
  const app = express();

  app.use(
    cors({
      origin: 'http://localhost:3001',
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
      credentials: true
    })
  );

  app.use(express.json());
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
