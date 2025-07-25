import express from 'express';
import { createPost } from './posts.js';

const router = express.Router();

// POST /api/test/create
router.post('/create', async (req, res) => {
  const { userId, text, imageUrl, hashtags } = req.body;
  const result = await createPost(userId, text, imageUrl, hashtags || []);
  res.json(result);
});

export default router;
