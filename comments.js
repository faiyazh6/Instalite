import { get_db_connection } from './server/models/rdbms.js';
//import { produceCommentEvent } from './server/kafka/produceCommentEvent.js';
import { CriteriaResultOutputParser } from 'langchain/evaluation';
const db = get_db_connection();


export async function addComment(postId, userId, text, parentCommentId = null) {
  try {
    const [result] = await db.send_sql(
      `INSERT INTO comments (post_id, user_id, text_content, parent_comment_id)
       VALUES (?, ?, ?, ?)`,
      [postId, userId, text, parentCommentId]
    );
    const commentID = result.insertId;

// 2) Fetch the commenting user’s username
const [[userRow]] = await db.send_sql(
  'SELECT username FROM users WHERE user_id = ?',
  [userId]
);
const username = userRow.username;

// 3) Fetch the post’s external UUID (so your consumer can look up the right post)
// const [[postRow]] = await db.send_sql(
//   'SELECT external_site_id FROM posts WHERE post_id = ?',
//   [postId]
// );
// const post_uuid_within_site = postRow.external_site_id;

// // 4) Publish the comment event to Kafka
// await produceCommentEvent({ username, post_uuid_within_site, text });

// 5) Return success
return { success: true, commentId };
} catch (err) {
console.error("addComment error:", err);
return { error: "Failed to add comment" };
}
}

export async function likeComment(commentId, userId) {
  try {
    const [rows] = await db.send_sql(
      "SELECT 1 FROM comment_likes WHERE comment_id = ? AND user_id = ?",
      [commentId, userId]
    );

    if (rows.length > 0) {
      return { error: "You have already liked this comment" };
    }
    await db.send_sql(
      `INSERT INTO comment_likes (comment_id, user_id)
       VALUES (?, ?)`,
      [commentId, userId]
    );

    return { success: true };
  } catch (err) {
    console.error("likeComment error:", err);
    return { error: "Failed to like comment" };
  }
}

export async function unlikeComment(commentId, userId) {
  try {
    const [rows] = await db.send_sql(
      "SELECT 1 FROM comment_likes WHERE comment_id = ? AND user_id = ?",
      [commentId, userId]
    );

    if (rows.length === 0) {
      return { error: "You have not liked this comment" };
    }

    await db.send_sql(
      "DELETE FROM comment_likes WHERE comment_id = ? AND user_id = ?",
      [commentId, userId]
    );

    return { success: true };
  } catch (err) {
    console.error("unlikeComment error:", err);
    return { error: "Failed to unlike comment" };
  }
}

export async function deleteComment(commentId, userId) {
  try {
    const [rows] = await db.send_sql(
      `SELECT c.user_id AS comment_owner, p.author AS post_owner
       FROM comments c
       JOIN posts p ON c.post_id = p.post_id
       WHERE c.comment_id = ?`,
      [commentId]
    );

    if (rows.length === 0) return { error: "Comment not found" };
    const { comment_owner, post_owner } = rows[0];

    if (userId !== comment_owner && userId !== post_owner) {
      return { error: "Unauthorized" };
    }

    await db.send_sql("DELETE FROM comments WHERE comment_id = ?", [commentId]);
    await db.send_sql("DELETE FROM comment_likes WHERE comment_id = ?", [commentId]);

    return { success: true };
  } catch (err) {
    console.error("deleteComment error:", err);
    return { error: "Failed to delete comment" };
  }
}

// export async function getCommentsForPosts(postIds) {
//   const db = get_db_connection();

//   if (!Array.isArray(postIds) || postIds.length === 0) {
//     return {}; // 🔒 early return to avoid SQL error
//   }

//   const placeholders = postIds.map(() => '?').join(',');
//   const [rows] = await db.send_sql(
//     `SELECT c.post_id, c.text_content, c.timestamp, u.username
//      FROM comments c
//      JOIN users u ON c.user_id = u.user_id
//      WHERE c.post_id IN (${placeholders})
//      ORDER BY c.timestamp ASC`,
//     postIds
//   );

//   const commentsByPost = {};
//   for (const row of rows) {
//     if (!commentsByPost[row.post_id]) commentsByPost[row.post_id] = [];
//     commentsByPost[row.post_id].push({
//       username: row.username,
//       text: row.text_content,
//       timestamp: row.timestamp,
//     });
//   }

//   return commentsByPost;
// }

export async function getCommentsForPosts(postIds = [], viewerId) {
  if (!postIds.length) return {};

  const [rows] = await db.send_sql(
    `
    SELECT
      c.comment_id,
      c.post_id,
      u.username,
      c.text_content   AS text,
      c.timestamp,
      COUNT(cl.user_id) AS likeCount,
      EXISTS (
        SELECT 1
          FROM comment_likes cl2
         WHERE cl2.comment_id = c.comment_id
           AND cl2.user_id    = ?
      ) AS liked
    FROM comments c
    JOIN users u
      ON u.user_id = c.user_id
    LEFT JOIN comment_likes cl
      ON cl.comment_id = c.comment_id
    WHERE c.post_id IN (?)
    GROUP BY c.comment_id
    ORDER BY c.timestamp ASC
    `,
    [viewerId, postIds]
  );

  return rows.reduce((acc, r) => {
    if (!acc[r.post_id]) acc[r.post_id] = [];
    acc[r.post_id].push({
      commentId: r.comment_id,
      username:  r.username,
      text:      r.text,
      timestamp: r.timestamp,
      likeCount: Number(r.likeCount),
      liked:     Boolean(r.liked),
    });
    return acc;
  }, {});
}