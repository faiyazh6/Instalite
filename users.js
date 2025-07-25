import { get_db_connection } from './server/models/rdbms.js';
import bcrypt from 'bcrypt';

export async function createUser({ login, password, firstName, lastName, email, affiliation, hashtags }) {
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const db = await get_db_connection().connect();

    const [result] = await db.send_sql(
      `INSERT INTO users 
        (username, hashed_password, email, first_name, last_name, affiliation, hashtag_text) 
        VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [login, hashedPassword, email, firstName, lastName, affiliation, JSON.stringify(hashtags)]
    );

    return { success: true, userId: result.insertId };
  } catch (err) {
    console.error("createUser error:", err);
    return { error: err };
  }
}

export async function authenticateUser({ login, password }) {
  try {
    const db = await get_db_connection().connect();
    const [users] = await db.send_sql(
      "SELECT user_id, username, hashed_password FROM users WHERE username = ? OR email = ?",
      [login, login]
    );

    if (users.length === 0) return { error: "User not found" };

    const user = users[0];

    // Debugging bcrypt comparison
    console.log("Authenticating user:", login);
    console.log("Input password:", password);
    console.log("Stored hash:", user.hashed_password);

    const match = await bcrypt.compare(password, user.hashed_password);

    console.log("Password match?", match);

    if (!match) return { error: "Invalid password" };

    await db.send_sql("UPDATE users SET is_online = TRUE WHERE user_id = ?", [user.user_id]);
    return { success: true, userId: user.user_id, username: user.username, is_online: true };

  } catch (err) {
    console.error("authenticateUser error:", err);
    return { error: "Authentication failed" };
  }
}

export async function getUserById(userId) {
  try {
    const db = await get_db_connection().connect();
    const [users] = await db.send_sql(
      "SELECT *, CAST(JSON_EXTRACT(hashtag_text, '$') AS CHAR) AS hashtag_text FROM users WHERE user_id = ?",
      [userId]
    );
    return users.length > 0 ? users[0] : null;
  } catch (err) {
    console.error("getUserById error:", err);
    return null;
  }
}

export async function updateUserEmail(userId, newEmail) {
  try {
    const db = await get_db_connection().connect();
    await db.send_sql(
      "UPDATE users SET email = ? WHERE user_id = ?",
      [newEmail, userId]
    );
    return { success: true };
  } catch (err) {
    console.error("updateUserEmail error:", err);

    // Duplicate‑email error from MySQL
    if (err.code === "ER_DUP_ENTRY" && err.sqlMessage.includes("users.email")) {
      return { error: "Email already registered." };
    }

    return { error: "Failed to update email" };
  }
}


export async function updateUserPassword(userId, newHashedPassword) {
  try {
    const db = await get_db_connection().connect();
    await db.send_sql("UPDATE users SET hashed_password = ? WHERE user_id = ?", [newHashedPassword, userId]);
    return { success: true };
  } catch (err) {
    console.error("updateUserPassword error:", err);
    return { error: "Failed to update password" };
  }
}

export async function updateHashtags(userId, hashtagList) {
  try {
    console.log("updateHashtags received hashtagList:", hashtagList);
    const db = await get_db_connection().connect();
    await db.send_sql(
      "UPDATE users SET hashtag_text = CAST(? AS JSON) WHERE user_id = ?",
      [JSON.stringify(hashtagList), userId]
    );
    return { success: true };
  } catch (err) {
    console.error("updateHashtags error:", err);
    return { error: "Failed to update hashtags" };
  }
}

export async function setUserOnlineStatus(userId, isOnline) {
  try {
    const db = await get_db_connection().connect();
    await db.send_sql("UPDATE users SET is_online = ? WHERE user_id = ?", [isOnline, userId]);
    return { success: true };
  } catch (err) {
    console.error("setUserOnlineStatus error:", err);
    return { error: "Failed to update online status" };
  }
}

export async function getTopHashtags(userId) {
  try {
    const db = await get_db_connection().connect();
    const [rows] = await db.send_sql(
      "SELECT JSON_UNQUOTE(JSON_EXTRACT(hashtag_text, '$')) AS hashtag_text FROM users WHERE user_id = ?",
      [userId]
    );
    if (rows.length === 0) return [];
    return JSON.parse(rows[0].hashtag_text || "[]");
  } catch (err) {
    console.error("getTopHashtags error:", err);
    return [];
  }
}

/**
 * Update the first_name column for a user.
 */
export async function updateFirstName(userId, firstName) {
  try {
    const db = await get_db_connection().connect();
    await db.send_sql(
      "UPDATE users SET first_name = ? WHERE user_id = ?",
      [firstName, userId]
    );
    return { success: true };
  } catch (err) {
    console.error("updateFirstName error:", err);
    return { error: "Failed to update first name" };
  }
}

/**
 * Update the last_name column for a user.
 */
export async function updateLastName(userId, lastName) {
  try {
    const db = await get_db_connection().connect();
    await db.send_sql(
      "UPDATE users SET last_name = ? WHERE user_id = ?",
      [lastName, userId]
    );
    return { success: true };
  } catch (err) {
    console.error("updateLastName error:", err);
    return { error: "Failed to update last name" };
  }
}

/**
 * Update the username column for a user.
 * Make sure to check for duplicates before calling this.
 */
export async function updateUsername(userId, username) {
  try {
    const db = await get_db_connection().connect();
    await db.send_sql(
      "UPDATE users SET username = ? WHERE user_id = ?",
      [username, userId]
    );
    return { success: true };
  } catch (err) {
    console.error("updateUsername error:", err);
    if (err.code === "ER_DUP_ENTRY" && err.sqlMessage.includes("users.username")) {
      return { error: "Username already taken." };
    }
    return { error: "Failed to update username" };
  }
}

/**
 * Update the affiliation column for a user.
 */
export async function updateAffiliation(userId, affiliation) {
  try {
    const db = await get_db_connection().connect();
    await db.send_sql(
      "UPDATE users SET affiliation = ? WHERE user_id = ?",
      [affiliation, userId]
    );
    return { success: true };
  } catch (err) {
    console.error("updateAffiliation error:", err);
    return { error: "Failed to update affiliation" };
  }
}

/**
 * Update the birthday column for a user.
 * Expects birthday in YYYY‑MM‑DD format (or another valid SQL date string).
 */
export async function updateBirthday(userId, birthday) {
  try {
    const db = await get_db_connection().connect();
    await db.send_sql(
      "UPDATE users SET birthday = ? WHERE user_id = ?",
      [birthday, userId]
    );
    return { success: true };
  } catch (err) {
    console.error("updateBirthday error:", err);
    return { error: "Failed to update birthday" };
  }
}


export function getUserImageByID(userId) {
  return '/placeholder_profile_picture.png';
}


/**
 * Search users by username, first_name, or last_name (partial match).
 * Returns an array of user objects with: user_id, username, first_name, last_name, profile_image_url.
 */
export async function searchUsers(query) {
  const db = await get_db_connection().connect();
  const sql = `
    SELECT user_id, username, first_name, last_name, profile_image_url
      FROM users
     WHERE username LIKE ?
        OR first_name LIKE ?
        OR last_name LIKE ?
     LIMIT 25
  `;
  const params = [`%${query}%`, `%${query}%`, `%${query}%`];
  const [rows] = await db.send_sql(sql, params);
  return rows;
}