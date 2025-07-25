// index.js
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// AWS / S3 helpers
import { uploadToS3, getSignedUrl } from './utils/s3.js';

// face‐embedding pipeline
import { generateFaceEmbedding } from './utils/face_embed.js';

// ChromaDB helpers (both face‐matching & chatbot)
import {
  createRetrieverFromDatabase,
  storeUserEmbedding,
  getTopFaceMatches
} from './utils/vector.js';

// your DB utilities
import { updateUserRecord, createStatusPost } from './utils/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

async function handleSelectActor(req, res) {
  const { userId, actorId, imageUrl } = req.body;
  // 1) record the actor → user link
  await updateUserRecord(userId, { linkedActorId: actorId });
  // 2) save the actual image URL in the users table
  await updateUserRecord(userId, { profile_image_url: imageUrl });
  // (optionally) status post
  await createStatusPost(
    userId,
    `User ${userId} is now linked to actor ${actorId}`
  );
  res.json({ success: true });
}

async function startServer() {
  // 1) Initialize chatbot retriever
  console.log('→ Initializing Chatbot retriever…');
  await createRetrieverFromDatabase();

  // 2) Express setup
  const app = express();

  // CORS & JSON body parsing
  app.use(cors({
    origin: 'http://localhost:3001',
    credentials: true
  }));
  app.use(express.json());

  // ensure uploads dir
  const uploadsDir = path.join(__dirname, 'uploads');
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);

  // Multer for multipart
  const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadsDir),
    filename:    (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
  });
  const upload = multer({ storage });

  // S3 bucket check
  console.log("→ Using S3 bucket:", process.env.S3_BUCKET);
  if (!process.env.S3_BUCKET) {
    console.error("Missing S3_BUCKET env var—set that in your .env!");
    process.exit(1);
  }

  // ——— Upload + Match Endpoint ———
  app.post(
    '/uploadProfileImage',
    upload.single('profileImage'),
    async (req, res) => {
      try {
        const userId = req.body.userId;
        if (!userId) return res.status(400).json({ error: 'Missing userId' });

        const file = req.file;
        if (!file) return res.status(400).json({ error: 'No file uploaded' });

        // 1) read & embed from buffer
        const buffer    = fs.readFileSync(file.path);
        const embedding = await generateFaceEmbedding(buffer);

        // 2) push to S3
        const ext = path.extname(file.originalname);
        const key = `profile_photos/${userId}-${Date.now()}${ext}`;
        await uploadToS3(file.path, key);

        // 3) signed URL for clients
        const imageUrl = getSignedUrl(key);
        console.log('Signed URL for download:', imageUrl);

        // 4) cleanup local file
        fs.unlinkSync(file.path);

        // 5) persist to your DB + vector store
        await updateUserRecord(userId, { profileImageUrl: imageUrl });
        await storeUserEmbedding(userId, embedding);

        // 6) query ChromaDB
        const actorMatches = await getTopFaceMatches(
          req.body.userId,
          embedding,
          5
        );

        return res.json({ success: true, imageUrl, actorMatches });
      } catch (err) {
        // log full error
        console.error('Error in /uploadProfileImage:', err);
        // send message + top of stack back to client
        return res.status(500).json({
          error: err.message,
          stack: (err.stack || '').split('\n').slice(0, 5)
        });
      }
    }
  );

  // ——— Link Actor Endpoint ———
  app.post('/linkActorToUser', async (req, res) => {
    try {
      const { userId, actorId } = req.body;
      if (!userId || !actorId) {
        return res.status(400).json({ error: 'Missing userId or actorId' });
      }

      await updateUserRecord(userId, { linkedActorId: actorId });
      await updateUserRecord(userId, { profileImageUrl: imageUrl });
      res.json({ success: true });
      await createStatusPost(
        userId,
        `User ${userId} is now linked to actor ${actorId}`
      );

      return res.json({ success: true });
    } catch (err) {
      console.error('Error in /linkActorToUser:', err);
      return res.status(500).json({ error: err.message });
    }
  });

  // start listening
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
}

startServer().catch(err => {
  console.error("Fatal error starting server:", err);
  process.exit(1);
});