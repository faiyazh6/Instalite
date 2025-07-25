// server/chat/websocket.js

import { Server } from 'socket.io';

let io = null;
const socketMappings = {}; // userId -> socket.id

function authenticateSocket(socket, next) {
  if (socket.handshake?.query?.token === 'valid-token' && socket.handshake?.query?.userId) {
    return next();
  }
  return next(new Error('Authentication failed'));
}

function initSocketServer(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });
  
  io.use(authenticateSocket);

  io.on('connection', (socket) => {
    const userId = socket.handshake.query.userId;
    socketMappings[userId] = socket.id;
    console.log(`${userId} connected as ${socket.id}`);//debug
    const onlineIds = Object.keys(socketMappings);
    socket.emit('onlineUsers', onlineIds);
    broadcastUserStatus(userId, true);
    


    socket.onAny((event, ...args) => {
      console.log(`EVENT RECEIVED: ${event}`, args);
    });

    socket.on('joinChat', (chatId, cb) => {
      console.log(`joinChat(${chatId}) called by ${userId}`);
      const res = joinChat(socket, chatId);
      cb(res);
      io.to(chatId).emit('userJoinedRoom', { userId, chatId });
    });

    socket.on('leaveChat', (chatId, cb) => {
      console.log(`leaveChat(${chatId}) called by ${userId}`);
      const res = leaveChat(socket, chatId);
      cb(res);
      io.to(chatId).emit('userLeftRoom', { userId, chatId });
    });

    socket.on('sendMessage', (data, cb) => {
      console.log(`sendMessage by ${userId}:`, data);
      emitChatMessage(data.chatId, { senderId: userId, text: data.message });
      cb({ success: true });
    });

    socket.on('sendInvite', (data, cb) => {
      console.log(`sendInvite from ${userId} to ${data.inviteeId} for ${data.chatId}`);
      emitInvite(data.inviteeId, data.chatId, userId);
      cb({ success: true });
    });

    socket.on('requestOnlineUsers', () => {
      socket.emit('onlineUsers', Object.keys(socketMappings));
    });

    socket.on('disconnect', () => {
      console.log(`${userId} disconnected`);
      // inside socket.on('disconnect', …)
      cleanupOnDisconnect(userId);
    });
  });
}

function broadcastUserStatus(userId, isOnline) {
  io.emit(isOnline ? 'userConnected' : 'userDisconnected', userId);
}

function emitChatRenamed(chatId, name) {
  io?.to(chatId).emit('chatRenamed', { chatId, name });
}

function emitInvite(inviteeId, chatId, inviterName) {
  const inviteeSocketId = socketMappings[inviteeId];
  if (inviteeSocketId) {
    console.log(`[EMIT] Invite to ${inviteeId} on socket ${inviteeSocketId}`);
    io.to(inviteeSocketId).emit('chatInvite', { chatId, inviterName });
  } else {
    console.log(`[MISS] Invitee socket not found for ${inviteeId}`);
  }
}

function emitChatMessage(chatId, message) {
  if (!io) {
    console.log(`[SKIP] emitChatMessage skipped, io not initialized`);
    return;
  }
  io.to(chatId).emit('chatMessage', { chatId, ...message });
}

function joinChat(socket, chatId) {
  try {
    socket.join(chatId);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}




function leaveChat(socket, chatId) {
  try {
    socket.leave(chatId);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

function cleanupOnDisconnect(userId) {
  delete socketMappings[userId];
  broadcastUserStatus(userId, false);
}

function getIO() {
  return io;
}

export {
  initSocketServer,
  authenticateSocket,
  broadcastUserStatus,
  emitInvite,
  emitChatMessage,
  joinChat,
  leaveChat,
  cleanupOnDisconnect,
  getIO,
  emitChatRenamed
};