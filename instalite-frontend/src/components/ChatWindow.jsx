import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function ChatWindow({
  title,
  messages,
  userId,
  members = [],    // ← now coming from ChatsPage, each member has .online
  onSend
}) {
  // DEBUG: confirm we received the members prop
  console.log("ChatWindow got members:", members);

  const [text, setText] = useState("");
  const scrollRef = useRef(null);
  const navigate  = useNavigate();

  // Auto‑scroll when new messages arrive
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async () => {
    const msg = text.trim();
    if (!msg) return;
    await onSend(msg);
    setText("");
  };

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      height: "80vh",
      minHeight: 0
    }}>
      {/* Header: avatar strip + title */}
      <div style={{
        display: "flex",
        alignItems: "center",
        padding: "12px 16px",
        borderBottom: "1px solid #ddd",
        background: "#f5f5f5"
      }}>
        <div style={{ display: "flex", marginRight: 12 }}>
          {members.map(u => (
            <div key={u.userId} style={{ position: 'relative', marginRight: 4 }}>
              <img
                src={`http://localhost:3030/users/${u.userId}/image`}
                alt={`${u.username}’s avatar${u.online ? ' (online)' : ''}`}
                onClick={() => navigate(`/user/${u.username}`)}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  cursor: "pointer"
                }}
              />
              {u.online && (
                <span
                  style={{
                    position: 'absolute',
                    bottom: 0,
                    right: 0,
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: 'limegreen',
                    border: '2px solid white'
                  }}
                />
              )}
            </div>
          ))}
        </div>
        <div style={{ fontWeight: "bold" }}>{title}</div>
      </div>

      {/* Messages list */}
      <div style={{
        flex: 1,
        overflowY: "auto",
        padding: 16,
        background: "#fff",
        display: "flex",
        flexDirection: "column",
        minHeight: 0
      }}>
        {messages.map((m, i) => {
          const mine      = m.senderId === userId;
          const avatarUrl = `http://localhost:3030/users/${m.senderId}/image`;

          return (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: mine ? "flex-end" : "flex-start",
                width: "100%",
                margin: "8px 0"
              }}
            >
              {/* Avatar on left for others */}
              {!mine && (
                <img
                  src={avatarUrl}
                  alt={`${m.senderName}’s avatar`}
                  onClick={() => navigate(`/user/${m.senderUsername}`)}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: "50%",
                    marginRight: 8,
                    cursor: "pointer"
                  }}
                />
              )}

              {/* Message bubble */}
              <div style={{
                maxWidth: "75%",
                padding: "8px",
                borderRadius: 4,
                background: mine ? "#dcf8c6" : "#eee",
                textAlign: mine ? "right" : "left"
              }}>
                <div
                  style={{
                    fontSize: "0.9em",
                    marginBottom: 4,
                    fontWeight: mine ? "bold" : "normal",
                    cursor: "pointer",
                    textDecoration: "underline"
                  }}
                  onClick={() => navigate(`/user/${m.senderUsername}`)}
                >
                  {m.senderName}
                </div>
                <div>{m.text}</div>
              </div>

              {/* Avatar on right for yourself */}
              {mine && (
                <img
                  src={avatarUrl}
                  alt="Your avatar"
                  onClick={() => navigate(`/user/${m.senderUsername}`)}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: "50%",
                    marginLeft: 8,
                    cursor: "pointer"
                  }}
                />
              )}
            </div>
          );
        })}
        <div ref={scrollRef} />
      </div>

      {/* Input bar */}
      <div style={{
        padding: 12,
        borderTop: "1px solid #ddd",
        background: "#f5f5f5"
      }}>
        <div style={{ display: "flex" }}>
          <input
            style={{
              flex: 1,
              marginRight: 8,
              padding: "8px",
              borderRadius: 4,
              border: "1px solid #ccc"
            }}
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter") {
                e.preventDefault();
                send();
              }
            }}
            placeholder="Type a message…"
          />
          <button onClick={send}>Send</button>
        </div>
      </div>
    </div>
  );
}
