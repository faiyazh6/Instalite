// dev/create_chats.js
import { createChat, sendMessage } from './server/chat/chat.js';

const charlie = 3, alice = 1, bob = 2;

const testChats = [
  { members: [charlie, alice], message: "Hey Alice, it's Charlie!" },
  { members: [charlie, bob], message: "Hey Bob, Charlie here!" },
  { members: [charlie, alice, bob], message: "Group chat with Alice and Bob!" }
];

const run = async () => {
  for (const chat of testChats) {
    const result = await createChat(chat.members);
    if (result.success) {
      await sendMessage(result.chatId, chat.members[0], chat.message);
      console.log(`Created chat ${result.chatId} and sent message`);
    } else {
      console.log('Failed to create chat:', result);
    }
  }
  process.exit(0);
};

run();
