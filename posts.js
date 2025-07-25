// import { get_db_connection } from './server/models/rdbms.js';
// import { producePostEvent } from './server/kafka/producePostEvent.js';
// import { getCommentsForPosts } from './comments.js';

// const db = get_db_connection();

// export async function createPost(userId, text, imageUrl = null, hashtags = []) {
//   try {
//     const [result] = await db.send_sql(
//       "INSERT INTO posts (author, text_content, image_url, hashtag_text) VALUES (?, ?, ?, ?)",
//       [userId, text, imageUrl, JSON.stringify(hashtags)]
//     );
//     const postId = result.insertId;

//     if (hashtags.length > 0) {
//       await linkPostToHashtags(postId, hashtags);
//     }

//     const [userResult] = await db.send_sql(
//       "SELECT username FROM users WHERE user_id = ?",
//       [userId]
//     );
//     const username = userResult[0]?.username || `user_${userId}`;

//     await producePostEvent({
//       username,
//       post_text: text,
//       attach: imageUrl,
//       hashtags
//     });

//     return { success: true, postId };
//   } catch (err) {
//     console.error("createPost error:", err);
//     return { error: "Failed to create post" };
//   }
// }

// export async function deletePost(postId, authorId) {
//   try {
//     // First, delete associated comments
//     await db.send_sql(`DELETE FROM comments WHERE post_id = ?`, [postId]);

//     // Then, delete the post
//     const [result] = await db.send_sql(
//       `DELETE FROM posts WHERE post_id = ? AND author = ?`,
//       [postId, authorId]
//     );

//     return result.affectedRows > 0;
//   } catch (err) {
//     console.error("deletePost error:", err);
//     return false;
//   }
// }

// export async function likePost(postId, userId) {
//   try {
//     const [rows] = await db.send_sql(
//       "SELECT 1 FROM post_likes WHERE post_id = ? AND user_id = ?",
//       [postId, userId]
//     );

//     if (rows.length > 0) {
//       return { error: "You have already liked this post" };
//     }
//     await db.send_sql(
//       "INSERT INTO post_likes (post_id, user_id) VALUES (?, ?)",
//       [postId, userId]
//     );

//     return { success: true };
//   } catch (err) {
//     console.error("likePost error:", err);
//     return { error: "Failed to like post" };
//   }
// }

// export async function unlikePost(postId, userId) {
//   try {
//     const [rows] = await db.send_sql(
//       "SELECT 1 FROM post_likes WHERE post_id = ? AND user_id = ?",
//       [postId, userId]
//     );

//     if (rows.length === 0) {
//       return { error: "You have not liked this post" };
//     }

//     await db.send_sql(
//       "DELETE FROM post_likes WHERE post_id = ? AND user_id = ?",
//       [postId, userId]
//     );

//     return { success: true };
//   } catch (err) {
//     console.error("unlikePost error:", err);
//     return { error: "Failed to unlike post" };
//   }
// }

// export async function linkPostToHashtags(postId, hashtags) {
//   try {
//     for (const tag of hashtags) {
//       await db.send_sql(
//         `INSERT INTO hashtags (hashtag, count)
//          VALUES (?, 1)
//          ON DUPLICATE KEY UPDATE count = count + 1`,
//         [tag]
//       );
//     }
//     return { success: true };
//   } catch (err) {
//     console.error("linkPostToHashtags error:", err);
//     return { error: "Failed to link hashtags" };
//   }
// }

// function safeParseJSON(value) {
//   if (Array.isArray(value)) return value;
//   if (typeof value === 'string') {
//     try {
//       const parsed = JSON.parse(value);
//       return Array.isArray(parsed) ? parsed : [];
//     } catch {
//       return [];
//     }
//   }
//   return [];
// }
// export async function getPostsByUser(authorId, viewerId) {
//   try {
//     const db = await get_db_connection().connect();

//     const [posts] = await db.send_sql(
//       `SELECT
//          p.post_id,
//          p.text_content,
//          p.timestamp,
//          p.image_url,
//          p.hashtag_text,
//          u.username AS author_username,
//          u.profile_image_url,
//          COUNT(pl.user_id) AS likeCount,
//          EXISTS (
//            SELECT 1 FROM post_likes pl2
//            WHERE pl2.post_id = p.post_id AND pl2.user_id = ?
//          ) AS liked
//        FROM posts p
//        JOIN users u ON p.author = u.user_id
//        LEFT JOIN post_likes pl ON p.post_id = pl.post_id
//        WHERE p.author = ?
//        GROUP BY p.post_id`,
//       [viewerId, authorId]
//     );

//     if (posts.length === 0) return [];

//     const postIds = posts.map((r) => r.post_id);
//     const commentsByPost = await getCommentsForPosts(postIds, userId);

//     return posts.map((post) => ({
//       postId: post.post_id,
//       text: post.text_content,
//       timestamp: post.timestamp,
//       imageUrl: post.image_url,
//       author: post.author_username,
//       profileImage: post.profile_image_url,
//       likeCount: post.likeCount || 0,
//       liked: Boolean(post.liked),
//       hashtags: safeParseJSON(post.hashtag_text),
//       comments: commentsByPost[post.post_id] || [],
//     }));
//   } catch (err) {
//     console.error("getPostsByUser error:", err);
//     throw err;
//   }
// }
// // export async function getPostsByUser(userId) {
// //   try {
// //     const db = await get_db_connection().connect();

// //     // 1) Pull everything, aliasing columns to JS-friendly names:
// //     const [posts] = await db.send_sql(
// //       `SELECT
// //          p.post_id,
// //          p.text_content,
// //          p.timestamp,
// //          p.image_url,
// //          p.hashtag_text,
// //          u.username AS author_username,
// //          u.profile_image_url,
// //          COUNT(pl.user_id) AS likeCount,
// //          EXISTS (
// //            SELECT 1 FROM post_likes pl2
// //            WHERE pl2.post_id = p.post_id AND pl2.user_id = ?
// //          ) AS liked
// //        FROM posts p
// //        JOIN users u ON p.author = u.user_id
// //        LEFT JOIN post_likes pl ON p.post_id = pl.post_id
// //        WHERE p.author = ?
// //        GROUP BY p.post_id`,
// //       [userId, userId]
// //     );

// //     // If no posts, just return empty array
// //     if (posts.length === 0) return [];

// //     // 2) Batch-load comments
// //     const postIds = posts.map((r) => r.postId);
// //     const commentsByPost = await getCommentsForPosts(postIds);

// //     // 3) Build the final JS objects
// //     return posts.map((post) => ({
// //       postId: post.post_id,
// //       text: post.text_content,
// //       timestamp: post.timestamp,
// //       imageUrl: post.image_url,
// //       author: post.author_username,
// //       profileImage: post.profile_image_url,
// //       likeCount: post.likeCount || 0,
// //       liked: Boolean(post.liked),
// //       hashtags: safeParseJSON(post.hashtag_text),
// //       comments: commentsByPost[post.post_id] || [],
// //     }));
// //   } catch (err) {
// //     console.error("getPostsByUser error:", err);
// //     throw err;
// //   }
// // }

// export async function getPostsForUser(userId) {
//   try {
//     // Step 1: Get post_ids from ranked_feed for the given user, ordered by rank
//     const [rankedRows] = await db.send_sql(
//       "SELECT post_id FROM ranked_feed WHERE user_id = ? ORDER BY `rank` ASC",
//       [userId]
//     );

//     const postIds = rankedRows.map((row) => row.post_id);

//     if (postIds.length === 0) return [];

//     // Step 2: Fetch full post details for these ranked post IDs
//     const [posts] = await db.send_sql(
//       `SELECT p.post_id,
//               p.text_content,
//               p.timestamp,
//               p.image_url,
//               p.hashtag_text,
//               u.username AS author_username,
//               u.profile_image_url,
//               COUNT(pl.user_id) AS likeCount,
//               EXISTS (
//                 SELECT 1 FROM post_likes pl2
//                 WHERE pl2.post_id = p.post_id AND pl2.user_id = ?
//               ) AS liked
//          FROM posts p
//          JOIN users u ON p.author = u.user_id
//          LEFT JOIN post_likes pl ON p.post_id = pl.post_id
//         WHERE p.post_id IN (?)
//         GROUP BY p.post_id`,
//       [userId, postIds]  
//     );

//     // Step 3: Preserve original rank order
//     const postMap = new Map();
//     posts.forEach((post) => postMap.set(post.post_id, post));
//     const orderedPosts = postIds.map((id) => postMap.get(id)).filter(Boolean);

//     // Step 4: Attach comments
//     const commentsByPost = await getCommentsForPosts(postIds, viewerId);

//     return orderedPosts.map((post) => ({
//       postId: post.post_id,
//       text: post.text_content,
//       timestamp: post.timestamp,
//       imageUrl: post.image_url,
//       author: post.author_username,
//       profileImageUrl: post.profile_image_url,
//       likeCount: post.likeCount || 0,
//       liked: !!post.liked,
//       hashtags: safeParseJSON(post.hashtag_text),
//       comments: commentsByPost[post.post_id] || []
//     }));
//   } catch (err) {
//     console.error("getPostsForUser error:", err);
//     return { error: "Failed to retrieve ranked posts" };
//   }
// }

// // export async function getCommentsForPosts(postIds, viewerId) {
// //   if (!postIds.length) return {};
// //   const db = get_db_connection();
// //   const [rows] = await db.send_sql(
// //     `
// //     SELECT
// //       c.comment_id,
// //       c.post_id,
// //       u.username,
// //       c.text_content AS text,
// //       c.timestamp,
// //       COUNT(cl.user_id) AS likeCount,
// //       EXISTS(
// //         SELECT 1
// //           FROM comment_likes cl2
// //          WHERE cl2.comment_id = c.comment_id
// //            AND cl2.user_id = ?
// //       ) AS liked
// //     FROM comments c
// //     JOIN users u
// //       ON u.user_id = c.user_id
// //     LEFT JOIN comment_likes cl
// //       ON cl.comment_id = c.comment_id
// //     WHERE c.post_id IN (?)
// //     GROUP BY c.comment_id
// //     ORDER BY c.timestamp ASC
// //     `,
// //     [viewerId, postIds]
// //   );

// //   return rows.reduce((acc, r) => {
// //     if (!acc[r.post_id]) acc[r.post_id] = [];
// //     acc[r.post_id].push({
// //       commentId: r.comment_id,
// //       username:  r.username,
// //       text:      r.text,
// //       timestamp: r.timestamp,
// //       likeCount: Number(r.likeCount),
// //       liked:     Boolean(r.liked),
// //     });
// //     return acc;
// //   }, {});
// // }

// posts.js
import { get_db_connection } from './server/models/rdbms.js';
import { producePostEvent }   from './server/kafka/producePostEvent.js';
import { getCommentsForPosts } from './comments.js';

const db = get_db_connection();

function safeParseJSON(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

export async function createPost(userId, text, imageUrl = null, hashtags = []) {
  try {
    const [result] = await db.send_sql(
      `INSERT INTO posts (author, text_content, image_url, hashtag_text)
         VALUES (?, ?, ?, ?)`,
      [userId, text, imageUrl, JSON.stringify(hashtags)]
    );
    const postId = result.insertId;

    if (hashtags.length) {
      for (const tag of hashtags) {
        await db.send_sql(
          `INSERT INTO hashtags (hashtag, count)
             VALUES (?, 1)
             ON DUPLICATE KEY UPDATE count = count + 1`,
          [tag]
        );
      }
    }

    const [[{ username }]] = await db.send_sql(
      `SELECT username FROM users WHERE user_id = ?`,
      [userId]
    );

    await producePostEvent({
      username:    username || `user_${userId}`,
      post_text:   text,
      attach:      imageUrl,
      hashtags,
    });

    return { success: true, postId };
  } catch (err) {
    console.error("createPost error:", err);
    return { error: "Failed to create post" };
  }
}

export async function deletePost(postId, authorId) {
  try {
    await db.send_sql(`DELETE FROM comments WHERE post_id = ?`, [postId]);
    const [res] = await db.send_sql(
      `DELETE FROM posts WHERE post_id = ? AND author = ?`,
      [postId, authorId]
    );
    return res.affectedRows > 0;
  } catch (err) {
    console.error("deletePost error:", err);
    return false;
  }
}

export async function likePost(postId, userId) {
  try {
    const [rows] = await db.send_sql(
      `SELECT 1 FROM post_likes WHERE post_id = ? AND user_id = ?`,
      [postId, userId]
    );
    if (rows.length) {
      return { error: "You have already liked this post" };
    }
    await db.send_sql(
      `INSERT INTO post_likes (post_id, user_id) VALUES (?, ?)`,
      [postId, userId]
    );
    return { success: true };
  } catch (err) {
    console.error("likePost error:", err);
    return { error: "Failed to like post" };
  }
}

export async function unlikePost(postId, userId) {
  try {
    const [rows] = await db.send_sql(
      `SELECT 1 FROM post_likes WHERE post_id = ? AND user_id = ?`,
      [postId, userId]
    );
    if (!rows.length) {
      return { error: "You have not liked this post" };
    }
    await db.send_sql(
      `DELETE FROM post_likes WHERE post_id = ? AND user_id = ?`,
      [postId, userId]
    );
    return { success: true };
  } catch (err) {
    console.error("unlikePost error:", err);
    return { error: "Failed to unlike post" };
  }
}

export async function getPostsByUser(authorId, viewerId) {
  try {
    const [posts] = await db.send_sql(
      `SELECT
         p.post_id,
         p.text_content,
         p.timestamp,
         p.image_url,
         p.hashtag_text,
         u.username           AS author_username,
         u.profile_image_url,
         COUNT(pl.user_id)    AS likeCount,
         EXISTS (
           SELECT 1
             FROM post_likes pl2
            WHERE pl2.post_id = p.post_id
              AND pl2.user_id = ?
         ) AS liked
       FROM posts p
       JOIN users u  ON u.user_id = p.author
       LEFT JOIN post_likes pl ON pl.post_id = p.post_id
       WHERE p.author = ?
       GROUP BY p.post_id`,
      [viewerId, authorId]
    );

    if (!posts.length) return [];
    
    if (posts.length === 0) return [];

    const postIds = posts.map((r) => r.post_id);
    const commentsByPost = await getCommentsForPosts(postIds, viewerId);

    return posts.map((post) => ({
      postId:          post.post_id,
      text:            post.text_content,
      timestamp:       post.timestamp,
      imageUrl:        post.image_url,
      author:          post.author_username,
      profileImageUrl: post.profile_image_url,
      likeCount:       Number(post.likeCount) || 0,
      liked:           Boolean(post.liked),
      hashtags:        safeParseJSON(post.hashtag_text),
      comments:        commentsByPost[post.post_id] || []
    }));
  } catch (err) {
    console.error("getPostsByUser error:", err);
    throw err;
  }
}

/** <=== HERE’S THE FIXED FUNCTION ===> **/
export async function getPostsForUser(viewerId) {
// export async function getPostsByUser(userId) {
//   try {
//     const db = await get_db_connection().connect();

//     // 1) Pull everything, aliasing columns to JS-friendly names:
//     const [posts] = await db.send_sql(
//       `SELECT
//          p.post_id,
//          p.text_content,
//          p.timestamp,
//          p.image_url,
//          p.hashtag_text,
//          u.username AS author_username,
//          u.profile_image_url,
//          COUNT(pl.user_id) AS likeCount,
//          EXISTS (
//            SELECT 1 FROM post_likes pl2
//            WHERE pl2.post_id = p.post_id AND pl2.user_id = ?
//          ) AS liked
//        FROM posts p
//        JOIN users u ON p.author = u.user_id
//        LEFT JOIN post_likes pl ON p.post_id = pl.post_id
//        WHERE p.author = ?
//        GROUP BY p.post_id`,
//       [userId, userId]
//     );

//     // If no posts, just return empty array
//     if (posts.length === 0) return [];

//     // 2) Batch-load comments
//     const postIds = posts.map((r) => r.postId);
//     const commentsByPost = await getCommentsForPosts(postIds);

//     // 3) Build the final JS objects
//     return posts.map((post) => ({
//       postId: post.post_id,
//       text: post.text_content,
//       timestamp: post.timestamp,
//       imageUrl: post.image_url,
//       author: post.author_username,
//       profileImage: post.profile_image_url,
//       likeCount: post.likeCount || 0,
//       liked: Boolean(post.liked),
//       hashtags: safeParseJSON(post.hashtag_text),
//       comments: commentsByPost[post.post_id] || [],
//     }));
//   } catch (err) {
//     console.error("getPostsByUser error:", err);
//     throw err;
//   }
// }

export async function getPostsForUser(userId, limit = 10, offset = 0) {
  try {
    // 1) ranked_feed → post IDs
    const [rankedRows] = await db.send_sql(
      `SELECT post_id
         FROM ranked_feed
        WHERE user_id = ?
        ORDER BY \`rank\` ASC`,
      [viewerId]
    );
    const postIds = rankedRows.map((r) => r.post_id);
    if (!postIds.length) return [];

    // 2) pull posts + like info
      `SELECT post_id
         FROM ranked_feed
        WHERE user_id = ?
        ORDER BY \`rank\` ASC
        LIMIT ? OFFSET ?`,
      [userId, limit, offset]
    );    

    const postIds = rankedRows.map((row) => row.post_id);
    if (postIds.length === 0) return [];
    
    const [posts] = await db.send_sql(
      `SELECT
         p.post_id,
         p.text_content,
         p.timestamp,
         p.image_url,
         p.hashtag_text,
         u.username           AS author_username,
         u.profile_image_url,
         COUNT(pl.user_id)    AS likeCount,
         EXISTS (
           SELECT 1
             FROM post_likes pl2
            WHERE pl2.post_id = p.post_id
              AND pl2.user_id = ?
         ) AS liked
       FROM posts p
       JOIN users u  ON u.user_id = p.author
       LEFT JOIN post_likes pl ON pl.post_id = p.post_id
       WHERE p.post_id IN (?)
       GROUP BY p.post_id`,
      // << use viewerId here! >>
      [viewerId, postIds]
      `SELECT p.post_id,
              p.text_content,
              p.timestamp,
              p.image_url,
              p.hashtag_text,
              u.username AS author_username,
              u.profile_image_url,
              COUNT(pl.user_id) AS likeCount,
              EXISTS (
                SELECT 1 FROM post_likes pl2
                WHERE pl2.post_id = p.post_id AND pl2.user_id = ?
              ) AS liked
         FROM posts p
         JOIN users u ON p.author = u.user_id
         LEFT JOIN post_likes pl ON p.post_id = pl.post_id
        WHERE p.post_id IN (?)
        GROUP BY p.post_id`,
      [userId, postIds]
    );

    // 3) maintain original feed order
    const byId = new Map(posts.map((p) => [p.post_id, p]));
    const ordered = postIds.map((id) => byId.get(id)).filter(Boolean);
    const postMap = new Map();
    posts.forEach((post) => postMap.set(post.post_id, post));
    const orderedPosts = postIds.map((id) => postMap.get(id)).filter(Boolean);

    // 4) fetch comment‐likes for each post
    const commentsByPost = await getCommentsForPosts(postIds, viewerId);

    // 5) shape to front‐end
    return ordered.map((r) => ({
      postId:          r.post_id,
      text:            r.text_content,
      timestamp:       r.timestamp,
      imageUrl:        r.image_url,
      author:          r.author_username,
      profileImageUrl: r.profile_image_url,
      likeCount:       Number(r.likeCount) || 0,
      liked:           Boolean(r.liked),
      hashtags:        safeParseJSON(r.hashtag_text),
      comments:        commentsByPost[r.post_id] || []
    const commentsByPost = await getCommentsForPosts(postIds);
    return orderedPosts.map((post) => ({
      postId: post.post_id,
      text: post.text_content,
      timestamp: post.timestamp,
      imageUrl: post.image_url,
      author: post.author_username,
      profileImageUrl: post.profile_image_url,
      likeCount: post.likeCount || 0,
      liked: !!post.liked,
      hashtags: safeParseJSON(post.hashtag_text),
      comments: commentsByPost[post.post_id] || [],
    }));
  } catch (err) {
    console.error("getPostsForUser error:", err);
    return { error: "Failed to retrieve ranked posts" };
  }
}


// export async function getCommentsForPosts(postIds, viewerId) {
//   if (!postIds.length) return {};
//   const db = get_db_connection();
//   const [rows] = await db.send_sql(
//     `
//     SELECT
//       c.comment_id,
//       c.post_id,
//       u.username,
//       c.text_content AS text,
//       c.timestamp,
//       COUNT(cl.user_id) AS likeCount,
//       EXISTS(
//         SELECT 1
//           FROM comment_likes cl2
//          WHERE cl2.comment_id = c.comment_id
//            AND cl2.user_id = ?
//       ) AS liked
//     FROM comments c
//     JOIN users u
//       ON u.user_id = c.user_id
//     LEFT JOIN comment_likes cl
//       ON cl.comment_id = c.comment_id
//     WHERE c.post_id IN (?)
//     GROUP BY c.comment_id
//     ORDER BY c.timestamp ASC
//     `,
//     [viewerId, postIds]
//   );

//   return rows.reduce((acc, r) => {
//     if (!acc[r.post_id]) acc[r.post_id] = [];
//     acc[r.post_id].push({
//       commentId: r.comment_id,
//       username:  r.username,
//       text:      r.text,
//       timestamp: r.timestamp,
//       likeCount: Number(r.likeCount),
//       liked:     Boolean(r.liked),
//     });
//     return acc;
//   }, {});
// }

export async function getPostLikeState(postId, userId) {
  const db = await get_db_connection();
  const [[result]] = await db.send_sql(
    `SELECT
       EXISTS (
         SELECT 1 FROM post_likes
         WHERE post_id = ? AND user_id = ?
       ) AS liked,
       (SELECT COUNT(*) FROM post_likes WHERE post_id = ?) AS likeCount`,
    [postId, userId, postId]
  );
  return {
    liked: Boolean(result.liked),
    likeCount: result.likeCount
  };
}
