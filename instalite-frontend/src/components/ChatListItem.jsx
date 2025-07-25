export default function ChatListItem({ chat, active, onSelect }) {
    const { chatId, members } = chat;
    const style = {
      padding:"10px 14px",
      cursor:"pointer",
      background: active ? "#eef" : "transparent",
      borderBottom:"1px solid #eee"
    };
    return (
      <div style={style} onClick={onSelect}>
        <strong>Chat {chatId}</strong>
        <div style={{ fontSize:12, color:"#666" }}>({members.join(", ")})</div>
      </div>
    );
  }
  