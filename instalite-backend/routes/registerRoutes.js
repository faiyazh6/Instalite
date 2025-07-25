/* ----------------------------------------------------------- */
/*  instalite‑backend/routes/registerRoutes.js                 */
/* ----------------------------------------------------------- */

import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);


// point diskStorage at /<project>/uploads
const uploadDir = path.resolve(__dirname, "..", "..", "uploads");
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // userId‐timestamp.ext → e.g. 42-1683456789012.png
    const ext  = path.extname(file.originalname);
    const name = `${req.session.user.userId}-${Date.now()}${ext}`;
    cb(null, name);
  },
});
const upload = multer({ storage });

/* ---- handlers re‑exported from routes.js ---- */
import {
  /* auth & search */
  handleGetProfileByUsername,
  handleLogin,
  handleRegister,
  handleSearch,
  handleLogout,
  handleLikePost,
  handleUnlikePost,
  handleLikeComment, 
  handleUnlikeComment,

  /* feed / profile / posts */
  handleGetFeed,
  handleUserProfile,
  handleCreatePost,

  /* chat core */
  handleCreateChat,
  handleRenameChat,  // NEW (rename a chat)
  handleSendMessage,
  handleLeaveChat,

  /* chat invites */
  handleInviteToChat,
  handleAcceptInvite,
  handleRejectInvite,
  handleRescindInvite,

  /* chat queries */
  handleGetChatHistory,
  handleGetInvites,
  handleGetUserChats,

  /* mutuals/users */
  handleGetMutuals,
  handleGetUserById,

  /* user image redirect */
  handleGetUserImage,

  /* settings */
  handleGetSettings,
  handleUpdateSettings,

  /* user search/follow */
  handleFollowUser,
  handleUnfollowUser,
  handleUserSearch,
  handlePostComment,
  handleDeletePost
} from "./routes.js";

/* optional DB helper for raw queries in post upload */
import { get_db_connection } from "../../server/models/rdbms.js";

/* ---------- session‑auth helper ---------- */
function requireSessionAuth(req, res, next) {
  if (!req.session || !req.session.user) {
    return res.status(401).json({ error: "Not logged in" });
  }
  next();
}

/**
 * Mount every HTTP route on the Express `app`.
 */
export default function registerRoutes(app) {
  /* ---------- USER IMAGE (placeholder / future CDN) ------- */
  app.get("/users/:userId/image", handleGetUserImage);
  +  /* ---------- LINK PROFILE PHOTO ------------------------- */
  app.post(
    "/user/link-photo",
    requireSessionAuth,
    async (req, res) => {
      const userId = req.session.user.userId;
      const { actorId, imageUrl } = req.body;
      try {
        const db = get_db_connection();
        await db.send_sql(
          `UPDATE users
             SET linked_actor_id   = ?,
                 profile_image_url = ?
           WHERE user_id = ?`,
          [actorId, imageUrl, userId]
        );
        return res.json({ success: true });
      } catch (err) {
        console.error("Link photo error:", err);
        return res
          .status(500)
          .json({ error: "Failed to link profile photo" });
      }
    }
  );

  /* ---------- AUTH & LOGOUT ------------------------------- */
  app.post("/auth/login",    handleLogin);
  app.post("/auth/register", handleRegister);
  app.post("/logout",        requireSessionAuth, handleLogout);

  /* ---------- CHATBOT SEARCH ------------------------------ */
  app.post("/search", requireSessionAuth, handleSearch);

  /* ---------- FEED & PROFILE ------------------------------ */
  app.post("/feed",  requireSessionAuth, handleGetFeed);
  app.post("/user",  requireSessionAuth, handleUserProfile);

  /* ---------- POST CREATION (with optional image) --------- */
  app.post(
    "/post/create",
    requireSessionAuth,
    upload.single("image"),
    async (req, res) => {
      const user = req.session.user;
      const textContent = req.body.text_content;
      let hashtags = [];
      try {
        hashtags = req.body.hashtag_text ? JSON.parse(req.body.hashtag_text) : [];
        if (!Array.isArray(hashtags)) throw new Error();
      } catch {
        return res
          .status(400)
          .json({ error: "hashtag_text must be a JSON array of strings" });
      }

      if (!textContent || !user)
        return res.status(400).json({ error: "Missing text or session" });

       const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;

      try {
        const db = get_db_connection();
        const ts = new Date();
        await db.send_sql(
          `INSERT INTO posts
             (author, text_content, hashtag_text, image_url, timestamp, is_external)
           VALUES (?, ?, ?, ?, ?, 0)`,
          [user.userId, textContent, JSON.stringify(hashtags), imageUrl, ts]
        );
        return res.json({ success: true });
      } catch (err) {
        console.error("DB insert error:", err);
        return res.status(500).json({ error: "Failed to create post" });
      }
    }
  );

  /* ---------- CHAT (sessions, messages) ------------------- */
  app.post("/post/comment", requireSessionAuth, handlePostComment);

  /*app.post(
    "/post/:postId/like",
    requireSessionAuth,
    handleLikePost
  );*/
  app.delete("/post/:postId", requireSessionAuth, handleDeletePost);
  app.post("/chat/create",       handleCreateChat);
  app.put ("/chat/:chatId/name", handleRenameChat);      // rename chat

  app.post("/chat/send",  handleSendMessage);
  app.post("/chat/leave", handleLeaveChat);

  /* invites */
  app.post("/chat/invite",            handleInviteToChat);
  app.post("/chat/invite/accept",     handleAcceptInvite);
  app.post("/chat/invite/reject",     handleRejectInvite);
  app.post("/chat/invite/rescind",    handleRescindInvite);

  /* queries */
  app.get("/chat/history",  handleGetChatHistory);
  app.get("/chat/invites",  handleGetInvites);
  app.get("/chat/sessions", handleGetUserChats);
  

  /* ---------- user search -------------------- */
  app.get("/users/search", handleUserSearch);
  
  /* ---------- MUTUALS ------------------------------------- */
  app.get("/mutuals", handleGetMutuals);
  app.get("/users/:userId", handleGetUserById);
  
  /* ---------- SESSION DEBUG (optional) -------------------- */
  app.get("/session", (req, res) =>
    res.json({ sessionUser: req.session?.user || null })
  );

  /* ---------- settings -------------------- */
  app.post("/settings", requireSessionAuth, handleUpdateSettings);
  app.get(  "/settings", requireSessionAuth, handleGetSettings);


  /* ---------- follow -------------------- */


  // follow action
  app.post("/users/:followeeId/follow",   requireSessionAuth, handleFollowUser);
  app.delete("/users/:followeeId/follow", requireSessionAuth, handleUnfollowUser);

  app.post("/post/:postId/like", requireSessionAuth, handleLikePost);
  app.delete("/post/:postId/like", requireSessionAuth, handleUnlikePost);

  app.get("/user/:username", requireSessionAuth, handleGetProfileByUsername);
  app.post("/post/comment", requireSessionAuth, handlePostComment);

  app.post   ("/comment/:commentId/like",   requireSessionAuth, handleLikeComment);
  app.delete ("/comment/:commentId/like",   requireSessionAuth, handleUnlikeComment);

}