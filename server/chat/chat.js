// server/chat/chat.js
import { get_db_connection } from "../models/rdbms.js";
import {
  emitInvite,
  emitChatMessage,
  emitChatRenamed,
  getIO
} from "./websocket.js";
import * as dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

/* ---------- env / db init ---------- */
const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
dotenv.config({ path: resolve(__dirname, "../../.env") });

let db; // deferred until initChatModule runs

export async function initChatModule() {
  db = get_db_connection();
  await db.connect();
}

/* ------------------------------------------------------------------ */
/*  CREATE CHAT                                                        */
/* ------------------------------------------------------------------ */
export async function createChat([inviterId]) {
  // only the inviter goes in
  const memberString = JSON.stringify([inviterId]);

  // check for an existing 1‑person session
  const [existing] = await db.send_sql(
    "SELECT chat_session_id FROM chat_sessions WHERE chat_members = ?",
    [memberString]
  );
  if (existing.length) {
    return { chatId: existing[0].chat_session_id, success: true };
  }

  // create a brand‑new one with only you in it
  const [result] = await db.send_sql(
    "INSERT INTO chat_sessions (chat_members) VALUES (?)",
    [memberString]
  );
  return { chatId: result.insertId, success: true };
}


/* ------------------------------------------------------------------ */
/*  SEND MESSAGE                                                       */
/* ------------------------------------------------------------------ */
export async function sendMessage(chatId, userId, message) {
  const [result] = await db.send_sql(
    "INSERT INTO chat_messages (chat_session_id, user_id, text_content) VALUES (?, ?, ?)",
    [chatId, userId, message]
  );
  emitChatMessage(chatId, { senderId: userId, text: message });
  return { success: true, messageId: result.insertId };
}

/* ------------------------------------------------------------------ */
/*  LEAVE CHAT (and cleanup if empty)                                  */
/* ------------------------------------------------------------------ */
export async function leaveChat(chatId, userId) {
  const [rows] = await db.send_sql(
    "SELECT chat_members FROM chat_sessions WHERE chat_session_id = ?",
    [chatId]
  );
  if (!rows.length) return { error: "Chat not found" };

  const members = JSON.parse(rows[0].chat_members).filter(id => id !== userId);

  if (members.length === 0) {
    await db.send_sql("DELETE FROM chat_invites  WHERE chat_session_id = ?", [chatId]);
    await db.send_sql("DELETE FROM chat_messages WHERE chat_session_id = ?", [chatId]);
    await db.send_sql("DELETE FROM chat_sessions WHERE chat_session_id = ?", [chatId]);

    getIO().emit("chatInvite");            // refresh invite panes everywhere
  } else {
    await db.send_sql(
      "UPDATE chat_sessions SET chat_members = ? WHERE chat_session_id = ?",
      [JSON.stringify(members), chatId]
    );
  }
  return { success: true };
}

/* ------------------------------------------------------------------ */
/*  INVITES                                                            */
/* ------------------------------------------------------------------ */
export async function inviteToChat(chatId, inviterId, inviteeId) {
  // ── 1) ensure that user actually exists
  const [userRows] = await db.send_sql(
    'SELECT 1 FROM users WHERE user_id = ?',
    [inviteeId]
  );
  if (userRows.length === 0) {
    return { error: 'Invitee not found' };
  }

  // ── 2) ensure either inviter follows invitee OR vice‑versa
  const [relRows] = await db.send_sql(
    `SELECT 1
       FROM friends
      WHERE (follower = ? AND following = ?)
         OR (follower = ? AND following = ?)`,
    [inviterId, inviteeId, inviteeId, inviterId]
  );
  if (relRows.length === 0) {
    return { error: 'Can only invite users you follow or who follow you' };
  }

  // ── 3) now do the invite
  await db.send_sql(
    'INSERT INTO chat_invites (sender_user_id, recipient_user_id, chat_session_id) VALUES (?, ?, ?)',
    [inviterId, inviteeId, chatId]
  );
  emitInvite(inviteeId, chatId, inviterId);
  return { success: true };
}


export async function acceptChatInvite(chatId, userId) {
  const [pending] = await db.send_sql(
    "SELECT 1 FROM chat_invites WHERE recipient_user_id = ? AND chat_session_id = ?",
    [userId, chatId]
  );
  if (!pending.length) return { error: "No pending invite" };

  const [rows] = await db.send_sql(
    "SELECT chat_members FROM chat_sessions WHERE chat_session_id = ?",
    [chatId]
  );
  if (!rows.length) return { error: "Chat not found" };

  const members = JSON.parse(rows[0].chat_members);
  if (!members.includes(userId)) members.push(userId);

  await db.send_sql(
    "UPDATE chat_sessions SET chat_members = ? WHERE chat_session_id = ?",
    [JSON.stringify(members), chatId]
  );
  await db.send_sql(
    "DELETE FROM chat_invites WHERE recipient_user_id = ? AND chat_session_id = ?",
    [userId, chatId]
  );
  return { success: true };
}

export async function rejectChatInvite(chatId, userId) {
  await db.send_sql(
    "DELETE FROM chat_invites WHERE recipient_user_id = ? AND chat_session_id = ?",
    [userId, chatId]
  );
  return { success: true };
}

export async function rescindInvite(chatId, inviterId, inviteeId) {
  await db.send_sql(
    "DELETE FROM chat_invites WHERE sender_user_id = ? AND recipient_user_id = ? AND chat_session_id = ?",
    [inviterId, inviteeId, chatId]
  );
  return { success: true };
}

/* ------------------------------------------------------------------ */
/*  HISTORY & INVITES QUERIES                                          */
/* ------------------------------------------------------------------ */

// server/chat/chat.js
export async function getChatHistory(chatId) {
  const [rows] = await db.send_sql(
    `SELECT
       cm.message_id,
       cm.user_id        AS senderId,
       u.username        AS senderUsername,
       cm.text_content   AS text,
       cm.timestamp
     FROM chat_messages cm
     JOIN users u ON u.user_id = cm.user_id
     WHERE cm.chat_session_id = ?
     ORDER BY cm.timestamp ASC`,
    [chatId]
  );
  return rows;
}


export async function getInvites(userId) {
  const [rows] = await db.send_sql(
    `SELECT
       CI.sender_user_id  AS senderId,
       CI.chat_session_id AS chatId,
       CS.chat_name       AS chatName,
       CI.timestamp       AS timestamp
     FROM chat_invites CI
     JOIN chat_sessions CS ON CI.chat_session_id = CS.chat_session_id
     WHERE CI.recipient_user_id = ?`,
    [userId]
  );
  return rows;
}

/* ------------------------------------------------------------------ */
/*  RENAME CHAT                                                        */
/* ------------------------------------------------------------------ */
export async function renameChat(chatId, newName) {
  const clean = newName.trim().slice(0, 255);
  await db.send_sql(
    "UPDATE chat_sessions SET chat_name = ? WHERE chat_session_id = ?",
    [clean, chatId]
  );
  emitChatRenamed(chatId, clean);
  return { success: true };
}

/* ------------------------------------------------------------------ */
/*  GET USER CHATS                                                     */
/* ------------------------------------------------------------------ */
export async function getUserChats(userId) {
  const uid = Number(userId);
  if (!uid) return [];

  const [rows] = await db.send_sql(
    `SELECT
       chat_session_id AS chatId,
       chat_members,
       chat_name
     FROM chat_sessions
     WHERE (
       JSON_VALID(chat_members)
       AND JSON_CONTAINS(chat_members, JSON_ARRAY(?))
     ) OR (
       NOT JSON_VALID(chat_members)
       AND CONCAT(',', chat_members, ',') LIKE CONCAT('%,', ?, ',%')
     )`,
    [uid, uid]
  );

  return rows.map(r => ({
    chatId : r.chatId,
    members: JSON.parse(r.chat_members),
    name   : r.chat_name
  }));
}