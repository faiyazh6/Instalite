// server/models/rag_helpers.js
import { get_db_connection } from './rdbms.js';

/**
 * Search users by matching:
 * - username, first_name, last_name, or affiliation
 * - OR linked actor's primary name from IMDb (via linked_actor_id → names.nconst)
 */
export async function searchUsersByQuery(query) {
    const db = get_db_connection();
  
    const keywords = query
      .toLowerCase()
      .split(/\s+/)
      .filter(word =>
        word.length > 2 &&
        !['what', 'has', 'and', 'the', 'who', 'did', 'how', 'are', 'you', 'was', 'she', 'in', 'with'].includes(word)
      );
  
    if (keywords.length === 0) return [];
  
    const likeClauses = keywords.map(() =>
      `(LOWER(u.username) LIKE ? OR LOWER(u.first_name) LIKE ? OR LOWER(u.last_name) LIKE ? OR LOWER(u.affiliation) LIKE ? OR LOWER(n.primaryName) LIKE ?)`
    ).join(" OR ");
  
    const likeParams = keywords.flatMap(w => [`%${w}%`, `%${w}%`, `%${w}%`, `%${w}%`, `%${w}%`]);
  
    const [rows] = await db.send_sql(
      `SELECT u.user_id, u.username, u.profile_image_url
       FROM users u
       LEFT JOIN names n ON u.linked_actor_id = n.nconst
       WHERE ${likeClauses}
       LIMIT 10`,
      likeParams
    );
  
    return rows;
  }
  

/**
 * Search posts by matching any significant word in:
 * - text_content
 * - hashtag_text (flattened to string)
 */
export async function searchPostsByQuery(query) {
  const db = get_db_connection();

  const keywords = query
    .toLowerCase()
    .split(/\s+/)
    .filter(word =>
      word.length > 2 &&
      !['what', 'has', 'and', 'the', 'who', 'did', 'how', 'are', 'you', 'was', 'she', 'in', 'with'].includes(word)
    );

  if (keywords.length === 0) return [];

  const likeClauses = keywords
    .map(() => `(LOWER(text_content) LIKE ? OR JSON_UNQUOTE(JSON_EXTRACT(hashtag_text, '$')) LIKE ?)`)
    .join(" OR ");

  const likeParams = keywords.flatMap(w => [`%${w}%`, `%${w}%`]);

  const [rows] = await db.send_sql(
    `SELECT post_id, author, text_content, hashtag_text, image_url, timestamp
     FROM posts
     WHERE ${likeClauses}
     ORDER BY timestamp DESC
     LIMIT 10`,
    likeParams
  );

  return rows;
}