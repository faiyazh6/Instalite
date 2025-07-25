import { createServer } from 'http';
import { io as Client } from 'socket.io-client';
import { initSocketServer, getIO } from '../chat/websocket.js';
import { jest } from '@jest/globals';

// Test timeout is 30s
jest.setTimeout(30000);

const PORT = 3000;
const BASE_URL = `http://localhost:${PORT}`;

const users = {
  user1: { id: 'user1', socket: null, events: [] },
  user2: { id: 'user2', socket: null, events: [] },
  user3: { id: 'user3', socket: null, events: [] }
};

let httpServer;

/**
 * 1) Start server before all tests
 */
beforeAll(async () => {
  httpServer = createServer();
  initSocketServer(httpServer);

  await new Promise((resolve, reject) => {
    httpServer.listen(PORT)
      .on('listening', resolve)
      .on('error', reject);
  });
});

/**
 * 2) Close server + Socket.IO after all tests
 */
afterAll(async () => {
  await disconnectUsers('user1', 'user2', 'user3');
  const ioInstance = getIO();
  if (ioInstance) {
    ioInstance.close();
  }
  await new Promise((res) => {
    httpServer.close(() => res());
  });
});


/**
 * Helper: connect user with the given userId
 */
async function connectUser(userId) {
  return new Promise((resolve) => {
    const socket = Client(BASE_URL, {
      query: { token: 'valid-token', userId }
    });
    socket.on('connect', () => resolve(socket));
  });
}

/**
 * Helper: connect multiple users in sequence
 */
async function connectUsers(...ids) {
  for (const id of ids) {
    users[id].socket = await connectUser(id);
    setupListeners(users[id]);
  }
}

/**
 * Helper: forcibly disconnect specified users
 */
async function disconnectUsers(...ids) {
  for (const id of ids) {
    const socket = users[id].socket;
    if (socket && socket.connected) {
      await new Promise((done) => {
        socket.on('disconnect', done);
        socket.disconnect();
      });
    }
    users[id].socket = null;
    users[id].events = [];
  }
}

/**
 * Helper: store important events in user.events
 * so we can verify them with `expect(...)`
 */
function setupListeners(user) {
  user.events = [];

  user.socket.on('userStatus', ({ userId, isOnline }) => {
    user.events.push(`userStatus:${userId}:${isOnline ? 'online' : 'offline'}`);
  });

  user.socket.on('chatInvite', (data) => {
    user.events.push(`invite:${data.inviterName}->${user.id}:${data.chatId}`);
  });

  user.socket.on('chatMessage', (msg) => {
    user.events.push(`message:${msg.senderId}->${user.id}:${msg.text}`);
  });

  user.socket.on('userJoinedRoom', ({ userId, chatId }) => {
    user.events.push(`joined:${userId}:${chatId}`);
  });

  user.socket.on('userLeftRoom', ({ userId, chatId }) => {
    user.events.push(`left:${userId}:${chatId}`);
  });
}

/**
 * Helper: reset environment by disconnecting all
 */
async function resetEnvironment() {
  await disconnectUsers('user1', 'user2', 'user3');
}

// ---------------------
// TEST CaseS
// ---------------------

test('Case 1: Status Tracking', async () => {
  await resetEnvironment();
  // user1 + user2 connect
  await connectUsers('user1', 'user2');

  // user2 disconnect
  await disconnectUsers('user2');

  // user2 reconnect
  await connectUsers('user2');

  // Check final results:
  // user1 should have seen user2 offline, then online
  const user1Events = users.user1.events.join('|');
  expect(user1Events).toContain('userStatus:user2:offline');
  expect(user1Events).toContain('userStatus:user2:online');
});

test('Case 2: Invite Delivery', async () => {
  await resetEnvironment();
  await connectUsers('user1', 'user2');

  // user1 invites user2 (with callback)
  users.user1.socket.emit(
    'sendInvite',
    { inviteeId: 'user2', chatId: 'chat-room' },
    () => {}
  );

  // wait a bit
  await new Promise(r => setTimeout(r, 500));

  // check that user2 saw invite
  expect(users.user2.events.join('|')).toContain('invite:user1->user2:chat-room');
});

test('Case 3: Message Isolation', async () => {
  await resetEnvironment();
  // user1 & user2 join room1, user3 does not
  await connectUsers('user1', 'user2', 'user3');

  // Provide callback as 3rd arg
  users.user1.socket.emit('joinChat', 'room1', () => {});
  users.user2.socket.emit('joinChat', 'room1', () => {});

  await new Promise(r => setTimeout(r, 200));

  // user1 sends message with callback
  users.user1.socket.emit(
    'sendMessage',
    { chatId: 'room1', userId: 'user1', message: 'hello room1' },
    () => {}
  );

  await new Promise(r => setTimeout(r, 500));

  // user1 + user2 see the message, user3 does not
  expect(users.user1.events.join('|')).toContain('message:user1->user1:hello room1');
  expect(users.user2.events.join('|')).toContain('message:user1->user2:hello room1');
  expect(users.user3.events.join('|')).not.toContain('hello room1');
});

test('Case 4: Join Visibility', async () => {
  await resetEnvironment();
  await connectUsers('user1', 'user2');

  // Both calls need callbacks
  users.user1.socket.emit('joinChat', 'room2', () => {});
  users.user2.socket.emit('joinChat', 'room2', () => {});
  await new Promise(r => setTimeout(r, 200));

  // user3 connects and joins room2 (with callback)
  await connectUsers('user3');
  users.user3.socket.emit('joinChat', 'room2', () => {});
  await new Promise(r => setTimeout(r, 500));

  // user1, user2 see user3 joined
  const user1Events = users.user1.events.join('|');
  expect(user1Events).toContain('joined:user3:room2');

  const user2Events = users.user2.events.join('|');
  expect(user2Events).toContain('joined:user3:room2');
});

test('Case 5: Leave Visibility', async () => {
  await resetEnvironment();
  await connectUsers('user1','user2','user3');

  // All 3 join chat room3
  users.user1.socket.emit('joinChat', 'room3', () => {});
  users.user2.socket.emit('joinChat', 'room3', () => {});
  users.user3.socket.emit('joinChat', 'room3', () => {});
  await new Promise(r => setTimeout(r, 300));

  // user3 leaves
  users.user3.socket.emit('leaveChat', 'room3', () => {});
  await new Promise(r => setTimeout(r, 500));

  // user1 + user2 see user3 left
  expect(users.user1.events.join('|')).toContain('left:user3:room3');
  expect(users.user2.events.join('|')).toContain('left:user3:room3');
});

test('Case 6: Disconnect Cleanup', async () => {
  await resetEnvironment();
  await connectUsers('user1','user2');

  // Both join room4 with callbacks
  users.user1.socket.emit('joinChat', 'room4', () => {});
  users.user2.socket.emit('joinChat', 'room4', () => {});
  await new Promise(r => setTimeout(r, 200));

  // user2 disconnect
  await disconnectUsers('user2');
  await new Promise(r => setTimeout(r, 300));

  // user1 sees user2 is offline
  expect(users.user1.events.join('|')).toContain('userStatus:user2:offline');
});

test('Case 7: Full Mixed Interaction', async () => {
  await resetEnvironment();
  await connectUsers('user1', 'user2', 'user3');

  // user1 joins chatA first
  users.user1.socket.emit('joinChat', 'chatA', () => {});
  await new Promise(r => setTimeout(r, 100));

  // user1 invites user2 to chatA
  users.user1.socket.emit(
    'sendInvite',
    { inviteeId: 'user2', chatId: 'chatA' },
    () => {}
  );
  await new Promise(r => setTimeout(r, 100));

  // user2 joins chatA
  users.user2.socket.emit('joinChat', 'chatA', () => {});
  await new Promise(r => setTimeout(r, 100));

  // user1 joins chatB
  users.user1.socket.emit('joinChat', 'chatB', () => {});
  await new Promise(r => setTimeout(r, 100));

  // user1 invites user3 to chatB
  users.user1.socket.emit(
    'sendInvite',
    { inviteeId: 'user3', chatId: 'chatB' },
    () => {}
  );
  await new Promise(r => setTimeout(r, 100));

  // user3 joins chatB
  users.user3.socket.emit('joinChat', 'chatB', () => {});
  await new Promise(r => setTimeout(r, 100));

  // user1 sends message to chatA
  users.user1.socket.emit(
    'sendMessage',
    { chatId: 'chatA', userId: 'user1', message: 'hello user2' },
    () => {}
  );
  await new Promise(r => setTimeout(r, 100));

  // user1 sends message to chatB
  users.user1.socket.emit(
    'sendMessage',
    { chatId: 'chatB', userId: 'user1', message: 'hello user3' },
    () => {}
  );
  await new Promise(r => setTimeout(r, 300)); // wait longer for final messages

  // === Logging ===
  //console.log('user1.events', users.user1.events);
  //console.log('user2.events', users.user2.events);
  //console.log('user3.events', users.user3.events);

  // === Assertions ===

  // user1
  const user1Events = users.user1.events.join('|');
  expect(user1Events).toContain('joined:user2:chatA');
  expect(user1Events).toContain('joined:user3:chatB');
  expect(user1Events).toContain('message:user1->user1:hello user2');
  expect(user1Events).toContain('message:user1->user1:hello user3');

  // user2
  const user2Events = users.user2.events.join('|');
  expect(user2Events).toContain('invite:user1->user2:chatA');
  expect(user2Events).toContain('joined:user2:chatA');
  expect(user2Events).toContain('message:user1->user2:hello user2');

  // user3
  const user3Events = users.user3.events.join('|');
  expect(user3Events).toContain('invite:user1->user3:chatB');
  expect(user3Events).toContain('joined:user3:chatB');
  expect(user3Events).toContain('message:user1->user3:hello user3');
});


test('Case 8: Invite While Offline', async () => {
  await resetEnvironment();
  await connectUsers('user1', 'user2', 'user3');

  // user1 joins chat1 so they can receive room events
  users.user1.socket.emit('joinChat', 'chat1', () => {});
  await new Promise(r => setTimeout(r, 100));

  // user1 invites user2 to chat1
  users.user1.socket.emit(
    'sendInvite',
    { inviteeId: 'user2', chatId: 'chat1' },
    () => {}
  );
  await new Promise(r => setTimeout(r, 100));

  // user2 joins chat1
  users.user2.socket.emit('joinChat', 'chat1', () => {});
  await new Promise(r => setTimeout(r, 100));

  // user3 disconnects
  await disconnectUsers('user3');
  await new Promise(r => setTimeout(r, 100));

  // user1 invites user3 while user3 is offline
  users.user1.socket.emit(
    'sendInvite',
    { inviteeId: 'user3', chatId: 'chat1' },
    () => {}
  );
  await new Promise(r => setTimeout(r, 100));

  // user3 reconnects and joins chat1
  await connectUsers('user3');
  users.user3.socket.emit('joinChat', 'chat1', () => {});
  await new Promise(r => setTimeout(r, 200));

  // checks for user1
  const user1Events = users.user1.events.join('|');
  expect(user1Events).toContain('joined:user2:chat1');
  expect(user1Events).toContain('joined:user3:chat1');
  expect(user1Events).toContain('userStatus:user3:offline');
  expect(user1Events).toContain('userStatus:user3:online');

  // checks for user2 
  const user2Events = users.user2.events.join('|');
  expect(user2Events).toContain('invite:user1->user2:chat1');
  expect(user2Events).toContain('joined:user2:chat1');
  expect(user2Events).toContain('joined:user3:chat1');
  expect(user2Events).toContain('userStatus:user3:offline');
  expect(user2Events).toContain('userStatus:user3:online');

  // checks for user3
  const user3Events = users.user3.events.join('|');
  // user3 was offline when invited, so no invite event expected
  expect(user3Events).toContain('joined:user3:chat1');
});
