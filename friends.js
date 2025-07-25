// friends.js

import { get_db_connection } from  './server/models/rdbms.js';

const db = get_db_connection();

export async function getFriendsForUser(userId) {
  // make sure we have a live connection
  await db.connect();

  // “friends” table has (follower, following)
  // here we return the users that “userId” is following
  const [rows] = await db.send_sql(
    `SELECT 
       u.user_id   AS userId,
       u.first_name AS firstName,
       u.last_name  AS lastName
     FROM friends f
     JOIN users   u ON u.user_id = f.following
     WHERE f.follower = ?
    `,
    [userId]
  );

  return rows;  // [ { userId, firstName, lastName }, … ]
}



export async function getMutualsForUser(userId) {
  const db = get_db_connection();

  // 1) Who follows you?
  const [followers] = await db.send_sql(
    `SELECT 
       f.follower      AS userId,
       u.first_name    AS firstName,
       u.last_name     AS lastName,
       u.username
     FROM friends f
     INNER JOIN users u
       ON f.follower = u.user_id
     WHERE f.following = ?`,
    [userId]
  );

  // 2) Who you follow?
  const [following] = await db.send_sql(
    `SELECT 
       f.following     AS userId,
       u.first_name    AS firstName,
       u.last_name     AS lastName,
       u.username
     FROM friends f
     INNER JOIN users u
       ON f.following = u.user_id
     WHERE f.follower = ?`,
    [userId]
  );

  // 3) Deduplicate by userId
  const map = new Map();
  for (const u of followers) map.set(u.userId, u);
  for (const u of following) map.set(u.userId, u);

  // 4) Return an array of user objects
  return Array.from(map.values());
}