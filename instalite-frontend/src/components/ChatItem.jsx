import ChatMessageForm from './ChatMessageForm';

export default function ChatItem({ chat, messages, addMessage }) {
  const chatId = chat.chatId ?? chat.chat_session_id;

  return (
    <div style={{ padding: 16 }}>
      {messages.map((m, idx) => (
        <p key={idx}>
          <strong>{m.senderId}:</strong> {m.text}
        </p>
      ))}

      {/* the form gets a callback so we can echo instantly */}
      <ChatMessageForm
        chatId={chatId}
        onLocalEcho={msg => addMessage(chatId, msg)}
      />
    </div>
  );
}
