// instalite‑backend/routes/routes.js
import {
  authenticateUser,
  createUser,
  getUserImageByID,
  getUserById,
  updateFirstName,
  updateLastName,
  updateUsername,
  updateUserEmail,
  updateAffiliation,
  updateBirthday,
  updateHashtags,
  updateUserPassword,
  searchUsers
} from "../../users.js";
import bcrypt from "bcrypt";

import { getIO } from "../../server/chat/websocket.js";
import { searchUsersByQuery, searchPostsByQuery } from "../../server/models/rag_helpers.js"; 
import { createRetrieverFromDatabase } from "../../installite-backend/utils/vector.js";
import { get_db_connection } from "../../server/models/rdbms.js";
import { likePost, unlikePost, getPostLikeState } from "../../posts.js";


import {
  createChat,
  sendMessage,
  leaveChat,
  inviteToChat,
  acceptChatInvite,
  rejectChatInvite,
  rescindInvite,
  getChatHistory,
  getInvites,
  getUserChats,
  renameChat,
} from "../../server/chat/chat.js";

import { getMutualsForUser } from "../../friends.js";
import { getPostsByUser, getPostsForUser, deletePost } from "../../posts.js";

/* ---- chatbot helpers ---- */
import { callChatbot } from "../../chatbot/chatbot.js";
import {
  ensureRetrieversReady,
  retrieveRelevantDocs
} from "../../installite-backend/utils/vector.js";

let retrieverInitialized = false;

/* ------------------------------------------------------------------ */
/*  Settings                                                          */
/* ------------------------------------------------------------------ */

/**
 * GET /settings
 * Returns the current user’s editable profile fields.
 */
export async function handleGetSettings(req, res) {
  const userId = req.session?.user?.userId;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  const u = await getUserById(userId);
  if (!u) return res.status(404).json({ error: "User not found" });
  return res.json({
    firstName:   u.first_name,
    lastName:    u.last_name,
    username:    u.username,
    email:       u.email,
    affiliation: u.affiliation,
    birthday:    u.birthday,
    hashtags:    JSON.parse(u.hashtag_text || "[]")
  });
}


/**
 * POST /settings
 * Updates any subset of the user’s editable fields.
 */
export async function handleUpdateSettings(req, res) {
  const userId = req.session?.user?.userId;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const {
    firstName, lastName,
    username,   email,
    affiliation, birthday,
    hashtags,
    oldPassword, newPassword
  } = req.body;

  const errors = [];

  // 1) If anything is changing, require & verify oldPassword
  const changingProfile =
    firstName || lastName || username ||
    email || affiliation || birthday ||
    (hashtags && hashtags.length > 0);
  const changingPassword = Boolean(newPassword);

  if (changingProfile || changingPassword) {
    if (!oldPassword) {
      return res.status(400)
        .json({ errors: ["Current password is required to update settings"] });
    }
    const userRec = await getUserById(userId);
    const ok = await bcrypt.compare(oldPassword, userRec.hashed_password);
    if (!ok) {
      return res.status(400)
        .json({ errors: ["Current password is incorrect"] });
    }
  }

  // 2) Apply profile updates
  if (firstName   !== undefined) await updateFirstName(userId, firstName);
  if (lastName    !== undefined) await updateLastName(userId, lastName);
  if (username    !== undefined) {
    const r = await updateUsername(userId, username);
    if (r.error) errors.push(r.error);
  }
  if (email       !== undefined) {
    const r = await updateUserEmail(userId, email);
    if (r.error) errors.push(r.error);
  }
  if (affiliation !== undefined) await updateAffiliation(userId, affiliation);
  if (birthday    !== undefined) {
    const r = await updateBirthday(userId, birthday);
    if (r.error) errors.push(r.error);
  }
  if (hashtags    !== undefined) {
    if (!Array.isArray(hashtags)) {
      errors.push("Hashtags must be an array of strings");
    } else {
      const r = await updateHashtags(userId, hashtags);
      if (r.error) errors.push(r.error);
    }
  }

  // 3) Finally handle password rotation
  if (changingPassword) {
    const hashed = await bcrypt.hash(newPassword, 10);
    const r = await updateUserPassword(userId, hashed);
    if (r.error) errors.push(r.error);
  }

  if (errors.length) {
    return res.status(400).json({ errors });
  }
  return res.json({ success: true });
}



/* ------------------------------------------------------------------ */
/*  AUTH                                                               */
/* ------------------------------------------------------------------ */
export async function handleLogin(req, res) {
  const result = await authenticateUser(req.body);
  if (result.error) return res.status(401).json({ error: result.error });

  // 1) set session
  req.session.user = {
    userId:   result.userId,
    username: result.username
  };

  // 2) pull the saved URL out of the users table
  const u = await getUserById(result.userId);

  // 3) return it so the front-end can store it
  return res.status(200).json({
    username:        result.username,
    profileImageUrl: u.profile_image_url || null
  });
}

export async function handleRegister(req, res) {
  try {
    const createResult = await createUser(req.body);
    if (createResult.error) {
      if (createResult.error.code === "ER_DUP_ENTRY") {
        if (createResult.error.sqlMessage.includes("users.email")) {
          return res.status(400).json({ error: "Email already registered." });
        } else if (createResult.error.sqlMessage.includes("users.username")) {
          return res.status(400).json({ error: "Username already taken." });
        }
      }
      return res.status(400).json({ error: "Registration failed." });
    }

    const loginResult = await authenticateUser({
      login: req.body.login,
      password: req.body.password,
    });
    if (loginResult.error) {
      return res.status(500).json({ error: loginResult.error });
    }

    req.session.user = {
      userId: loginResult.userId,
      username: loginResult.username,
    };
    return res.status(200).json({ username: loginResult.username });
  } catch (err) {
    console.error("Registration error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

/* ------------------------------------------------------------------ */
/*  LOGOUT                                                              */
/* ------------------------------------------------------------------ */
export function handleLogout(req, res) {
  req.session.destroy(err => {
    if (err) {
      console.error("Logout error:", err);
      return res.status(500).json({ error: "Logout failed" });
    }
    return res.status(200).json({ success: true });
  });
}

/* ------------------------------------------------------------------ */
/*  CHATBOT SEARCH (stub)                                               */
/* ------------------------------------------------------------------ */
export async function handleSearch(req, res) {
  try {
    const { query } = req.body;

    if (!query || typeof query !== "string") {
      return res.status(400).json({ error: "Missing or invalid query" });
    }

    const result = await callChatbot(query);
    res.json(result);
  } catch (err) {
    console.error("Chatbot error:", err);
    res.status(500).json({ error: "Chatbot failed" });
  }
}

/* ------------------------------------------------------------------ */
/*  MUTUALS                                                           */
/* ------------------------------------------------------------------ */

/**
 * GET /mutuals?userId=…
 * Returns only users who either follow you or are followed by you.
 */
export async function handleGetMutuals(req, res) {
  // 1) make sure ?userId= is present
  if (req.query.userId == null) {
    return res.status(400).json({ error: "Missing userId" });
  }
  // 2) parse & validate
  const userId = Number(req.query.userId);
  if (Number.isNaN(userId)) {
    return res.status(400).json({ error: "Invalid userId" });
  }

  try {
    // 3) fetch the two lists and merge
    const mutuals = await getMutualsForUser(userId);
    return res.json(mutuals);
  } catch (err) {
    console.error("Failed to load mutuals:", err);
    return res.status(500).json({ error: "Database error fetching mutuals" });
  }
}

/* ------------------------------------------------------------------ */
/*  FEED                                                                */
/* ------------------------------------------------------------------ */
export async function handleGetFeed(req, res) {
  const userId = req.session?.user?.userId;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  // ✅ PAGINATION: limit + offset
  const { limit = 5, offset = 0 } = req.body;

  const posts = await getPostsForUser(userId, limit, offset);

  return res.status(200).json(posts);
}


/* ------------------------------------------------------------------ */
/*  CHAT REST ENDPOINTS                                                 */
/* ------------------------------------------------------------------ */
export async function handleGetUserChats(req, res) {
  const userId = Number(req.query.userId);
  return res.json(await getUserChats(userId));
}

export async function handleRenameChat(req, res) {
  const chatId = Number(req.params.chatId);
  const { name } = req.body;
  await renameChat(chatId, name);
  getIO().to(String(chatId)).emit("chatRenamed", { chatId, name });
  return res.json({ success: true });
}

export async function handleCreateChat(req, res) {
  const { members, name = null } = req.body;
  return res.json(await createChat(members, name));
}

export async function handleSendMessage(req, res) {
  const { chatId, userId, message } = req.body;
  return res.json(await sendMessage(chatId, userId, message));
}

export async function handleLeaveChat(req, res) {
  const { chatId, userId } = req.body;
  return res.json(await leaveChat(chatId, userId));
}

export async function handleInviteToChat(req, res) {
  const { chatId, inviterId, inviteeId } = req.body;
  const result = await inviteToChat(chatId, inviterId, inviteeId);
  if (result.error) {
    return res.status(400).json({ error: result.error });
  }
  return res.json(result);
}


export async function handleAcceptInvite(req, res) {
  const { chatId, userId } = req.body;
  return res.json(await acceptChatInvite(chatId, userId));
}

export async function handleRejectInvite(req, res) {
  const { chatId, userId } = req.body;
  return res.json(await rejectChatInvite(chatId, userId));
}

export async function handleRescindInvite(req, res) {
  const { chatId, inviterId, inviteeId } = req.body;
  return res.json(await rescindInvite(chatId, inviterId, inviteeId));
}

export async function handleGetChatHistory(req, res) {
  return res.json(await getChatHistory(req.query.chatId));
}

export async function handleGetInvites(req, res) {
  return res.json(await getInvites(req.query.userId));
}

/* ------------------------------------------------------------------ */
/*  USER IMAGE (placeholder redirect)                                 */
/* ------------------------------------------------------------------ */
export async function handleGetUserImage(req, res) {
  const userId = Number(req.params.userId);
  // 1) fetch from DB
  const u = await getUserById(userId);
  // 2) if they have a saved URL, send that; otherwise fallback
  if (!u) {
    return res.redirect("/public/placeholder_profile_picture.png");
  }

  const imageUrl = u.profile_image_url || "/public/placeholder_profile_picture.png";

  // 3) if it’s an absolute S3/HTTP URL, redirect directly
  if (imageUrl.startsWith("http")) {
    return res.redirect(imageUrl);
  }
  // otherwise it’s a local path under your static server
  return res.redirect(`http://localhost:3030${imageUrl}`);
}

/* ------------------------------------------------------------------ */
/* REMOVE/ADD FOLLOW                                                  */
/* ------------------------------------------------------------------ */
export async function handleFollowUser(req, res) {
  // 1) Identify who’s following whom
  const followerId = req.session?.user?.userId;
  const followeeId = Number(req.params.followeeId);

  if (!followerId) {
    return res.status(401).json({ error: "Not logged in" });
  }
  if (!followeeId) {
    return res.status(400).json({ error: "Missing followeeId" });
  }

  // 2) Upsert the follow relationship
  try {
    const db = get_db_connection();
    await db.send_sql(
      `INSERT INTO friends (follower, following)
         VALUES (?, ?)
       ON DUPLICATE KEY UPDATE
         follower = follower`,        // idempotent
      [followerId, followeeId]
    );
    return res.json({ success: true });
  } catch (err) {
    console.error("Follow user failed:", err);
    return res.status(500).json({ error: "Database error" });
  }
}



export async function handleUnfollowUser(req, res) {
  const followerId = req.session.user.userId;
  const followeeId = Number(req.params.followeeId);
  if (!followeeId) {
    return res.status(400).json({ error: "Missing followeeId" });
  }

  try {
    const db = get_db_connection();
    await db.send_sql(
      `DELETE FROM friends
         WHERE follower  = ?
           AND following = ?`,
      [followerId, followeeId]
    );
    return res.json({ success: true });
  } catch (err) {
    console.error("Unfollow user failed:", err);
    return res.status(500).json({ error: "Database error" });
  }
}



/**
 * GET /users/search?q=...
 * Returns up to 25 matching users, each with an `initiallyFollowing` flag.
 */
export async function handleUserSearch(req, res) {
  const q = (req.query.q || "").trim();
  if (!q) return res.json([]);

  try {
    // 1) Fetch the matching rows
    const rows = await searchUsers(q);

    // 2) Who am I?
    const me = req.session?.user?.userId || null;

    // 3) Exclude myself from the results
    const filtered = me
      ? rows.filter(u => u.user_id !== me)
      : rows;

    // 4) Determine which of those I’m already following
    let followingSet = new Set();
    if (me && filtered.length) {
      const db = await get_db_connection().connect();
      const ids = filtered.map(u => u.user_id);
      const placeholders = ids.map(() => "?").join(",");
      const [follows] = await db.send_sql(
        `SELECT following
           FROM friends
          WHERE follower = ?
            AND following IN (${placeholders})`,
        [me, ...ids]
      );
      followingSet = new Set(follows.map(f => f.following));
    }

    // 5) Map into the shape React expects
    const result = filtered.map(u => ({
      userId:            u.user_id,
      username:          u.username,
      firstName:         u.first_name,
      lastName:          u.last_name,
      profileImageUrl:   u.profile_image_url,
      initiallyFollowing: me ? followingSet.has(u.user_id) : false
    }));

    return res.json(result);
  } catch (err) {
    console.error("handleUserSearch error:", err);
    return res.status(500).json({ error: "Failed to search users" });
  }
}






/* ------------------------------------------------------------------ */
/*  POSTS                                                               */
/* ------------------------------------------------------------------ */
export async function handleCreatePost(req, res) {
  const { text_content, hashtag_text, image_url } = req.body;
  const author = req.session?.user?.userId;
  if (!author) return res.status(401).json({ error: "Unauthorized" });

  try {
    const db = get_db_connection();
    const ts = new Date();

    const [result] = await db.send_sql(
      `INSERT INTO posts
         (author, text_content, hashtag_text, image_url, timestamp, is_external)
       VALUES (?, ?, ?, ?, ?, 0)`,
      [
        author,
        text_content,
        JSON.stringify(hashtag_text || []),
        image_url || null,
        ts
      ]
    );
    return res.json({ success: true, post_id: result.insertId });
  } catch (err) {
    console.error("Post creation failed:", err);
    return res.status(500).json({ error: "Database error creating post" });
  }
}

export async function handleUserProfile(req, res) {
  const userId = req.session?.user?.userId;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  try {
    const user  = await getUserById(userId);
    const posts = await getPostsByUser(userId);

    const db = get_db_connection();
    const [[{ followerCount }]] = await db.send_sql(
      "SELECT COUNT(*) AS followerCount FROM friends WHERE following = ?",
      [userId]
    );
    const [[{ followingCount }]] = await db.send_sql(
      "SELECT COUNT(*) AS followingCount FROM friends WHERE follower = ?",
      [userId]
    );

    return res.status(200).json({
      username: user.username,
      followerCount,
      followingCount,
      posts,
      profileImageUrl: user.profile_image_url
    });
  } catch (err) {
    console.error("handleUserProfile error:", err);
    return res.status(500).json({ error: "Failed to load user profile" });
  }
}

/**
 * GET /users/:userId
 * Returns { userId, username, firstName, lastName } for that user.
 */
export async function handleGetUserById(req, res) {
  const id = Number(req.params.userId);
  if (!id) return res.status(400).json({ error: "Invalid userId" });
  const u = await getUserById(id);
  if (!u) return res.status(404).json({ error: "User not found" });
  return res.json({
    userId:   u.user_id,
    username: u.username,
    firstName: u.first_name,
    lastName:  u.last_name,
  });
}

export async function handlePostComment(req, res) {
  const userId = req.session?.user?.userId;
  const { postId, content } = req.body;

  if (!userId || !postId || !content) {
    return res.status(400).json({ error: "Missing fields" });
  }

  try {
    const db = get_db_connection();
    await db.send_sql(
      `INSERT INTO comments (post_id, user_id, text_content)
       VALUES (?, ?, ?)`,
      [postId, userId, content]
    );
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("handlePostComment error:", err);
    return res.status(500).json({ error: "Failed to submit comment" });
  }
}

// export async function handleDeletePost(req, res) {
//   const userId = req.session?.user?.userId;
//   const postId = Number(req.params.postId);

//   if (!userId || !postId) {
//     return res.status(400).json({ error: "Missing user or post ID" });
//   }
// }

/**
 * GET /user/:username
 * Returns public profile info (posts, follower/following counts) for any user.
 */
export async function handleGetProfileByUsername(req, res) {
  const { username } = req.params;
  if (!username) return res.status(400).json({ error: "Missing username" });

  try {
    const db = get_db_connection();

    /* 1️⃣—pull the user row (include every field you’ll use) */
    const [[user]] = await db.send_sql(
      `SELECT user_id,
              username,
              first_name,
              last_name,
              profile_image_url
         FROM users
        WHERE username = ?`,
      [username]
    );
    if (!user) return res.status(404).json({ error: "User not found" });

    /* 2️⃣—posts + follower/following counts */
    const viewerId = req.session?.user?.userId;
    const posts = await getPostsByUser(user.user_id, viewerId);


    const [[{ followerCount }]]  = await db.send_sql(
      "SELECT COUNT(*) AS followerCount  FROM friends WHERE following = ?",
      [user.user_id]
    );
    const [[{ followingCount }]] = await db.send_sql(
      "SELECT COUNT(*) AS followingCount FROM friends WHERE follower  = ?",
      [user.user_id]
    );

    /* 3️⃣—send everything the React page expects */
    return res.json({
      userId:          user.user_id,
      username:        user.username,
      firstName:       user.first_name,
      lastName:        user.last_name,
      profileImageUrl: user.profile_image_url,
      followerCount,
      followingCount,
      posts
    });
  } catch (err) {
    console.error("handleGetProfileByUsername:", err);
    return res.status(500).json({ error: "DB error fetching profile" });
  }
}

// export async function handlePostComment(req, res) {
//   const userId = req.session?.user?.userId;
//   const { postId, content } = req.body;

//   if (!userId || !postId || !content) {
//     return res.status(400).json({ error: "Missing fields" });
//   }

//   try {
//     const db = get_db_connection();
//     await db.send_sql(
//       `INSERT INTO comments (post_id, user_id, text_content)
//        VALUES (?, ?, ?)`,
//       [postId, userId, content]
//     );
//     return res.status(200).json({ success: true });
//   } catch (err) {
//     console.error("handlePostComment error:", err);
//     return res.status(500).json({ error: "Failed to submit comment" });
//   }
// }


export async function handleDeletePost(req, res) {
  const userId = req.session?.user?.userId;
  const postId = Number(req.params.postId);

  if (!userId || !postId) {
    return res.status(400).json({ error: "Missing user or post ID" });
  }

  const result = await deletePost(postId, userId);
  if (result.error) {
    return res.status(403).json({ error: result.error });
  }

  return res.json({ success: true });
}

export async function handleLikePost(req, res) {
  const userId = req.session?.user?.userId;
  const postId = Number(req.params.postId);

  if (!userId || !postId) {
    return res.status(400).json({ error: "Missing user or post ID" });
  }

  try {
    const db = get_db_connection();
    await db.send_sql(
      `INSERT INTO post_likes (user_id, post_id)
       VALUES (?, ?)
       ON DUPLICATE KEY UPDATE user_id = user_id`,
      [userId, postId]
    );

    return res.json({ success: true });
  } catch (err) {
    console.error("Failed to like post:", err);
    return res.status(500).json({ error: "Database error" });
  }
}

export async function handleUnlikePost(req, res) {
  const userId = req.session?.user?.userId;
  const postId = Number(req.params.postId);

  if (!userId || !postId) {
    return res.status(400).json({ error: "Missing user or post ID" });
  }

  try {
    const db = get_db_connection();
    await db.send_sql(
      `DELETE FROM post_likes WHERE user_id = ? AND post_id = ?`,
      [userId, postId]
    );

    return res.json({ success: true });
  } catch (err) {
    console.error("Unlike post failed:", err);
    return res.status(500).json({ error: "Database error" });
  }
}

export async function handleLikeComment(req, res) {
  const userId    = req.session.user.userId;
  const commentId = Number(req.params.commentId);
  try {
    const db = get_db_connection();
    await db.send_sql(
      `INSERT IGNORE INTO comment_likes (comment_id, user_id) VALUES (?, ?)`,
      [commentId, userId]
    );
    const [[{ likeCount }]] = await db.send_sql(
      `SELECT COUNT(*) AS likeCount FROM comment_likes WHERE comment_id = ?`,
      [commentId]
    );
    res.json({ success: true, liked: true,  likeCount });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to like comment" });
  }
}

export async function handleUnlikeComment(req, res) {
  const userId    = req.session.user.userId;
  const commentId = Number(req.params.commentId);
  try {
    const db = get_db_connection();
    await db.send_sql(
      `DELETE FROM comment_likes WHERE comment_id = ? AND user_id = ?`,
      [commentId, userId]
    );
    const [[{ likeCount }]] = await db.send_sql(
      `SELECT COUNT(*) AS likeCount FROM comment_likes WHERE comment_id = ?`,
      [commentId]
    );
    res.json({ success: true, liked: false, likeCount });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to unlike comment" });
  }
}
