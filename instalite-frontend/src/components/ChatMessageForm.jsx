import { useState } from 'react';
import socket from '../socket';

export default function ChatMessageForm({ chatId, onLocalEcho }) {
  const [text, setText] = useState('');

  async function handleSend(e) {
    e.preventDefault();
    if (!text.trim()) return;

    // 1. optimistic local echo ↓
    onLocalEcho({ senderId: Number(localStorage.getItem('userId')), text });

    // 2. round-trip to the server
    socket.emit('sendMessage', { chatId, message: text });

    setText('');
  }

  return (
    <form onSubmit={handleSend} style={{ marginTop: 8 }}>
      <input
        style={{ width: '80%' }}
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder="Type…"
      />
      <button type="submit">Send</button>
    </form>
  );
}
