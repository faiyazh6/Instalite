import { get_db_connection } from '../models/rdbms.js';
import { jest } from '@jest/globals';

// Mock websocket before importing chat.js
jest.unstable_mockModule('../chat/websocket.js', () => ({
  emitChatMessage: jest.fn(),
  emitInvite: jest.fn()
}));

const websocket = await import('../chat/websocket.js');
const chat = await import('../chat/chat.js');

const db = get_db_connection();

beforeAll(async () => {
  await db.connect();

  // Clean up dependent tables first to avoid FK issues
  await db.send_sql("DELETE FROM chat_messages");
  await db.send_sql("DELETE FROM chat_invites");
  await db.send_sql("DELETE FROM chat_sessions");
  await db.send_sql("DELETE FROM users WHERE email IN (?, ?)", ['test1@email.com', 'test2@email.com']);

  // Insert dummy users
  const [res1] = await db.send_sql(
    "INSERT INTO users (username, hashed_password, email) VALUES (?, ?, ?)",
    ['test1', 'pass', 'test1@email.com']
  );
  const [res2] = await db.send_sql(
    "INSERT INTO users (username, hashed_password, email) VALUES (?, ?, ?)",
    ['test2', 'pass', 'test2@email.com']
  );
  global.testUsers = { user1Id: res1.insertId, user2Id: res2.insertId };
});

afterAll(async () => {
  await db.close();
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('Chat module basic behavior', () => {
  test('createChat should create new chat and return chatId', async () => {
    const members = [global.testUsers.user1Id, global.testUsers.user2Id];
    const res = await chat.createChat(members);
    expect(res.success).toBe(true);
    expect(res.chatId).toBeDefined();
  });

  test('sendMessage should insert message and call emitChatMessage', async () => {
    const members = [global.testUsers.user1Id, global.testUsers.user2Id];
    const chatId = (await chat.createChat(members)).chatId;
    const res = await chat.sendMessage(chatId, global.testUsers.user1Id, 'hello world');
    expect(res.success).toBe(true);
    expect(res.messageId).toBeDefined();
    expect(websocket.emitChatMessage).toHaveBeenCalledWith(
      chatId,
      expect.objectContaining({
        senderId: global.testUsers.user1Id,
        text: 'hello world'
      })
    );
  });

  test('inviteToChat should insert invite and call emitInvite', async () => {
    // Create a chat with only user1
    const chatId = (await chat.createChat([global.testUsers.user1Id])).chatId;
    const res = await chat.inviteToChat(chatId, global.testUsers.user1Id, global.testUsers.user2Id);
    expect(res.success).toBe(true);
    expect(websocket.emitInvite).toHaveBeenCalledWith(
      global.testUsers.user2Id,
      chatId,
      global.testUsers.user1Id
    );
  });

  test('getChatHistory should return messages in timestamp order', async () => {
    const members = [global.testUsers.user1Id, global.testUsers.user2Id];
    const chatId = (await chat.createChat(members)).chatId;

    // Clear any old messages for a clean test
    await db.send_sql('DELETE FROM chat_messages WHERE chat_session_id = ?', [chatId]);

    await chat.sendMessage(chatId, global.testUsers.user1Id, 'msg1');
    await chat.sendMessage(chatId, global.testUsers.user2Id, 'msg2');
    await chat.sendMessage(chatId, global.testUsers.user1Id, 'msg3');

    const history = await chat.getChatHistory(chatId);
    expect(history.length).toBeGreaterThanOrEqual(3);
    for (let i = 1; i < history.length; i++) {
      const prev = new Date(history[i - 1].timestamp);
      const curr = new Date(history[i].timestamp);
      expect(prev <= curr).toBe(true);
    }
  });

  test('acceptChatInvite should add user to chat and delete invite', async () => {
    // Create a chat with only user1
    const chatId = (await chat.createChat([global.testUsers.user1Id])).chatId;
    // Invite user2 to the chat
    await chat.inviteToChat(chatId, global.testUsers.user1Id, global.testUsers.user2Id);
    // Accept the invite as user2
    const resAccept = await chat.acceptChatInvite(chatId, global.testUsers.user2Id);
    expect(resAccept.success).toBe(true);

    // Check that the invite has been removed
    const invites = await chat.getInvites(global.testUsers.user2Id);
    expect(invites.length).toBe(0);

    // Verify that user2 is now included in the chat members
    const [rows] = await db.send_sql('SELECT chat_members FROM chat_sessions WHERE chat_session_id = ?', [chatId]);
    const members = JSON.parse(rows[0].chat_members);
    expect(members).toContain(global.testUsers.user2Id);
  });

  test('rejectChatInvite should delete an invite', async () => {
    // Create a chat with only user1
    const chatId = (await chat.createChat([global.testUsers.user1Id])).chatId;
    // Invite user2
    await chat.inviteToChat(chatId, global.testUsers.user1Id, global.testUsers.user2Id);
    // Reject the invite as user2
    const resReject = await chat.rejectChatInvite(chatId, global.testUsers.user2Id);
    expect(resReject.success).toBe(true);
    // Verify the invite is removed
    const invites = await chat.getInvites(global.testUsers.user2Id);
    expect(invites.length).toBe(0);
  });

  test('rescindInvite should remove an invite sent by the inviter', async () => {
    // Create a chat with only user1
    const chatId = (await chat.createChat([global.testUsers.user1Id])).chatId;
    // Invite user2
    await chat.inviteToChat(chatId, global.testUsers.user1Id, global.testUsers.user2Id);
    // Rescind the invite from user1 for user2
    const resRescind = await chat.rescindInvite(chatId, global.testUsers.user1Id, global.testUsers.user2Id);
    expect(resRescind.success).toBe(true);
    // Verify invite is removed
    const invites = await chat.getInvites(global.testUsers.user2Id);
    expect(invites.length).toBe(0);
  });
});
