// src/pages/ChatsPage.js
import { useEffect, useState, useCallback, useRef } from "react";
import socket from "../socket";
import ChatWindow from "../components/ChatWindow";

const uid = Number(localStorage.getItem("userId"));

// Helpers
const normalizeMembers = (arr = []) =>
  [...new Set(arr.map(Number))].sort((a, b) => a - b);

export default function ChatsPage() {
  const [chats, setChats] = useState([]);
  const [history, setHistory] = useState({});
  const [active, setActive] = useState(null);
  const [invites, setInvites] = useState([]);
  const [mutuals, setMutuals] = useState([]);

  // — invite picker state —
  const [inviteChatId, setInviteChatId] = useState(null);
  const [inviteOptions, setInviteOptions] = useState([]);
  const [selectedInvitee, setSelectedInvitee] = useState(null);

  // track who’s online (a Set of userIds)
  const [onlineUsers, setOnlineUsers] = useState(new Set());


  // add this:
  const [membersData, setMembersData] = useState([]);

  const idToName = useCallback((id) => {
    if (id === uid) return "You";
    const m = mutuals.find(u => u.userId === id);
    if (m) return m.firstName;
    const d = membersData.find(u => u.userId === id);
    if (d) return d.username;
    return `User ${id}`;
  }, [mutuals, membersData]);



  const joinedRooms = useRef(new Set());  


  // Load chats & histories
  const loadChats = useCallback(async () => {
    const sessions = await fetch(
      `http://localhost:3030/chat/sessions?userId=${uid}`
    ).then(r => r.json());
    const normalized = sessions.map(s => ({
      chatId: s.chatId ?? s.chat_session_id,
      members: normalizeMembers(
        Array.isArray(s.members) ? s.members : JSON.parse(s.chat_members)
      ),
      name: s.chat_name || s.name || null
    }));
    setChats(normalized);
    if (normalized.length && active === null) setActive(normalized[0].chatId);

    for (const c of normalized) {
      if (!history[c.chatId]) {
        const h = await fetch(
          `http://localhost:3030/chat/history?chatId=${c.chatId}`
        ).then(r => r.json());
        setHistory(prev => ({
          ...prev,
          [c.chatId]: h.map(m => ({
            senderId: m.senderId,
            text: m.text,
            senderName: idToName(m.senderId),
            senderUsername: m.senderUsername
          }))
        }));
      }
    }
  }, [active, idToName]);

  // Load invites
  const loadInvites = useCallback(async () => {
    const inv = await fetch(
      `http://localhost:3030/chat/invites?userId=${uid}`
    ).then(r => r.json());
    setInvites(inv);
  }, []);

  // Load mutuals (people you can chat with)
  const loadMutuals = useCallback(() => {
    fetch(`http://localhost:3030/mutuals?userId=${uid}`)
      .then(r => r.json())
      .then(setMutuals)
      .catch(console.error);
  }, []);

  // Fetch mutuals only once (on mount or when uid changes)
  useEffect(() => {
    if (uid) {
      loadMutuals();
    }
  }, [loadMutuals, uid]);

// Fetch chats & invites on mount and whenever their loaders change
  useEffect(() => {
    loadChats();
    loadInvites();
  }, [loadChats, loadInvites]);


  // auto-join socket rooms
  useEffect(() => {
    chats.forEach(c => {
      if (!joinedRooms.current.has(c.chatId)) {
        socket.emit("joinChat", c.chatId, () => {});
        socket.emit("requestOnlineUsers");
        joinedRooms.current.add(c.chatId);
      }
    });
  }, [chats]);

  // real-time handlers
  useEffect(() => {
    const onMsg = msg => {
      setHistory(prev => ({
        ...prev,
        [msg.chatId]: [
          ...(prev[msg.chatId] || []),
          {
            senderId: msg.senderId,
            senderName: idToName(msg.senderId),
            senderUsername: msg.senderUsername,
            text: msg.text
          }
        ]
      }));
    };
    const onInvite = () => {
      loadInvites();
      loadChats();
    };
    const onUserJoined = ({ chatId, userId }) => {
      setChats(prev =>
        [...prev].map(c =>
          c.chatId === chatId
            ? { ...c, members: normalizeMembers([...c.members, userId]) }
            : c
        )
      );
      //socket.emit("requestOnlineUsers");      
      if (active === chatId) {
        const otherIds = normalizeMembers([...chats.find(c => c.chatId === chatId)?.members || [], userId]).filter(id => id !== uid);
        Promise.all(
          otherIds.map(id =>
            fetch(`http://localhost:3030/users/${id}`)
              .then(r => r.ok ? r.json() : null)
              .catch(() => null)
          )
        ).then(results => {
          setMembersData(results.filter(u => u).map(u => ({
            userId: u.userId,
            username: u.username
          })));
        });
      }      
    };
    
    
    const onUserLeft = ({ chatId, userId }) => {
      setChats(prev => {
        const updated = [...prev]
          .map(c =>
            c.chatId === chatId
              ? { ...c, members: c.members.filter(id => id !== userId) }
              : c
          )
          .filter(c => !(chatId === c.chatId && userId === uid));
    
        if (active === chatId) {
          const activeChat = updated.find(c => c.chatId === chatId);
          const otherIds = activeChat
            ? activeChat.members.filter(id => id !== uid)
            : [];
          if (otherIds.length === 0) {
            setMembersData([]); 
          } else {
            Promise.all(
              otherIds.map(id =>
                fetch(`http://localhost:3030/users/${id}`)
                  .then(r => r.ok ? r.json() : null)
                  .catch(() => null)
              )
            ).then(results => {
              setMembersData(results.filter(u => u).map(u => ({
                userId: u.userId,
                username: u.username
              })));
            });
          }
        }
    
        return [...updated];
      });
      if (userId === uid && active === chatId) setActive(null);
    };
    

    const onRenamed = ({ chatId, name }) => {
      setChats(prev =>
        prev.map(c => (c.chatId === chatId ? { ...c, name } : c))
      );
      setInvites(prev =>
        prev.map(inv =>
          inv.chatId === chatId ? { ...inv, chatName: name } : inv
        )
      );
    };

    socket.on("chatMessage", onMsg);
    socket.on("chatInvite", onInvite);
    socket.on("userJoinedRoom", onUserJoined);
    socket.on("userLeftRoom", onUserLeft);
    socket.on("chatRenamed", onRenamed);


    const onOnlineUsers = ids =>
           setOnlineUsers(new Set(ids.map(id => Number(id))));
         const onUserConnected = id =>
           setOnlineUsers(prev => {
             const next = new Set(prev);
             next.add(Number(id));
             return next;
           });
    const onUserDisconnected = id =>
      setOnlineUsers(prev => {
        const next = new Set(prev);
        next.delete(Number(id));
        return next;
      });
  
   socket.on("onlineUsers", onOnlineUsers);
   socket.on("userConnected", onUserConnected);
   socket.on("userDisconnected", onUserDisconnected);

   //socket.emit("requestOnlineUsers")

    return () => {
      socket.off("chatMessage", onMsg);
      socket.off("chatInvite", onInvite);
      socket.off("userJoinedRoom", onUserJoined);
      socket.off("userLeftRoom", onUserLeft);
      socket.off("chatRenamed", onRenamed);
      // ——— off() for online‑status ———
      socket.off("onlineUsers", onOnlineUsers);
      socket.off("userConnected", onUserConnected);
      socket.off("userDisconnected", onUserDisconnected);
    };
  }, [chats, active, idToName, loadChats, loadInvites]);

  // Accept/reject invites
  async function acceptInvite(chatId) {
    await fetch("http://localhost:3030/chat/invite/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chatId, userId: uid })
    });
    socket.emit("joinChat", chatId, () => {});
    socket.emit("requestOnlineUsers");
    joinedRooms.current.add(chatId);
    loadChats();
    loadInvites();
  }
  async function rejectInvite(chatId) {
    await fetch("http://localhost:3030/chat/invite/reject", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chatId, userId: uid })
    });
    loadInvites();
  }

  // show invite‑picker for existing chat
  function sendInvite(chatId) {
    const chat = chats.find(c => c.chatId === chatId);
    const already = new Set(chat.members);
    const opts = mutuals.filter(u => !already.has(u.userId));
    if (opts.length === 0) return alert("No one left to invite.");
    setInviteOptions(opts);
    setInviteChatId(chatId);
    setSelectedInvitee(null);
  }
  async function confirmInvite() {
    if (!inviteChatId || !selectedInvitee) return;
    await fetch("http://localhost:3030/chat/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chatId: inviteChatId,
        inviterId: uid,
        inviteeId: selectedInvitee
      })
    });
    setInviteChatId(null);
    setInviteOptions([]);
    setSelectedInvitee(null);
    loadInvites();
  }

  // leave chat
  async function leaveChat(chatId) {
    await fetch("http://localhost:3030/chat/leave", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chatId, userId: uid })
    });
    setChats(prev => [...prev].filter(c => c.chatId !== chatId));
    if (active === chatId) setActive(null);
    socket.emit("leaveChat", chatId, () => {});
  }

  // rename chat
  async function renameChat(chatId) {
    const current = chats.find(c => c.chatId === chatId)?.name || "";
    const newName = prompt("New chat name:", current);
    if (!newName || newName.trim() === current) return;
    await fetch(`http://localhost:3030/chat/${chatId}/name`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim() })
    });
    setChats(prev =>
      [...prev].map(c =>
        c.chatId === chatId ? { ...c, name: newName.trim() } : c
      )
    );
  }

  // show invite‑picker to start a brand–new chat
  function createChat() {
    const opts = mutuals.filter(u =>
      !chats.some(c => c.members.includes(u.userId))
    );
    if (opts.length === 0) {
      return alert("You’re already in a chat with everyone.");
    }
    setInviteOptions(opts);
    setInviteChatId("new");
    setSelectedInvitee(null);
  }


  
    // Build default title from IDs
    const prettyMembers = (members) =>
      normalizeMembers(members)
        .filter(id => id !== uid)
        .map(id => idToName(id))
        .join(", ") || "You";
  
    // Final label: either custom name or default members list
    const chatLabel = (chat) =>
      chat.name?.trim() || prettyMembers(chat.members);

  async function confirmCreateAndInvite() {
    if (!selectedInvitee) return;
    // 1) create or fetch session
    const { chatId } = await fetch("http://localhost:3030/chat/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ members: [uid, selectedInvitee] })
    }).then(r => r.json());

    // 2) update UI & join
    setChats(prev => [
      ...prev,
      { chatId, members: [uid, selectedInvitee], name: null }
    ]);
    socket.emit("joinChat", chatId, () => {});
    socket.emit("requestOnlineUsers");
    joinedRooms.current.add(chatId);
    setHistory(prev => ({ ...prev, [chatId]: [] }));

    // 3) send invite
    await fetch("http://localhost:3030/chat/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chatId,
        inviterId: uid,
        inviteeId: selectedInvitee
      })
    });

    setInviteChatId(null);
    setInviteOptions([]);
    setSelectedInvitee(null);
    loadInvites();
  }

  
  const activeChat = chats.find(c => c.chatId === active) || { members: [] };
  useEffect(() => {
    if (active == null) {
      setMembersData([]);
      return;
    }
    // get the raw IDs for the active chat, excluding yourself
    const chat = chats.find(c => c.chatId === active);
    if (!chat) return;
    const otherIds = chat.members.filter(id => id !== uid);

    // fetch each other user’s record in parallel
    Promise.all(
      otherIds.map(id =>
        fetch(`http://localhost:3030/users/${id}`)
          .then(r => r.ok ? r.json() : null)
          .catch(() => null)
      )
    ).then(results => {
      // filter out any nulls, keep { userId, username } shape
      setMembersData(results.filter(u => u).map(u => ({
        userId:   u.userId,
        username: u.username
      })));
    });
  }, [active, chats]);
  
  const membersWithStatus = membersData.map(u => ({
    ...u,
    online: onlineUsers.has(u.userId),
  }));


  return (
    <div style={{ display: "flex", height: "70vh" }}>
      <aside style={{ width: 280, borderRight: "1px solid #ddd", padding: 12 }}>
        <section style={{ marginBottom: 24 }}>
          <h3>Invites</h3>
          {invites.length === 0 ? (
            <p><em>No pending invites</em></p>
          ) : (
            invites.map(inv => {
              const chat = chats.find(c => c.chatId === inv.chatId);
              const label = inv.chatName
                ? inv.chatName
                : chat
                  ? chatLabel(chat)
                  : `Chat ${inv.chatId}`;
              return (
                <div key={inv.chatId} style={{ marginBottom: 8 }}>
                  <strong>{idToName(inv.senderId)}</strong> invited you to{" "}
                  <strong>{label}</strong><br/>
                  <button onClick={() => acceptInvite(inv.chatId)}>Accept</button>{" "}
                  <button onClick={() => rejectInvite(inv.chatId)}>Reject</button>
                </div>
              );
            })
          )}
        </section>

        <section>
          <h3>Your Chats</h3>
          <button
            style={{ marginBottom: 8, fontSize: "0.9em" }}
            onClick={createChat}
          >
            + New Chat
          </button>

          {/* ——— INVITE PICKER UI ——— */}
          {inviteChatId && (
            <div style={{
              margin: "12px 0",
              padding: 12,
              border: "1px solid #ccc",
              borderRadius: 4,
              maxHeight: 200,
              overflowY: "auto"
            }}>
              <h4>
                {inviteChatId === "new"
                  ? "Start a new chat with…"
                  : "Invite someone to this chat"}
              </h4>
              {inviteOptions.map(u => (
                <div key={u.userId} style={{ marginBottom: 4 }}>
                  <label>
                    <input
                      type="radio"
                      name="invitee"
                      value={u.userId}
                      checked={selectedInvitee === u.userId}
                      onChange={() => setSelectedInvitee(u.userId)}
                    />{" "}
                    {u.firstName} {u.lastName}
                  </label>
                </div>
              ))}
              <div style={{ marginTop: 8 }}>
                <button
                  onClick={inviteChatId === "new" ? confirmCreateAndInvite : confirmInvite}
                  disabled={!selectedInvitee}
                  style={{ marginRight: 8 }}
                >
                  Confirm
                </button>
                <button
                  onClick={() => {
                    setInviteChatId(null);
                    setInviteOptions([]);
                    setSelectedInvitee(null);
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {chats.map(c => (
            <div
              key={c.chatId}
              onClick={() => setActive(c.chatId)}
              style={{
                padding: "8px 12px",
                cursor: "pointer",
                background: c.chatId === active ? "#eef" : undefined
              }}
            >
              <strong>{chatLabel(c)}</strong><br/>
              {(() => {
                const membersStr = prettyMembers(c.members);

                // 1) no one else? "Just you!"
                if (!membersStr || membersStr === "You") {
                  return <small><em>Just you!</em></small>;
                }
                // 2) 1:1 chat with default name? hide subtitle
                if (chatLabel(c) === membersStr) {
                  return null;
                }
                // 3) otherwise show list plain
                return <small>{membersStr}</small>;
              })()}<br/>

              <button
                style={{ fontSize: "0.8em", marginRight: 4 }}
                onClick={e => { e.stopPropagation(); renameChat(c.chatId); }}
              >
                Rename
              </button>
              <button
                style={{ fontSize: "0.8em", marginRight: 4 }}
                onClick={e => { e.stopPropagation(); sendInvite(c.chatId); }}
              >
                Invite
              </button>
              <button
                style={{ fontSize: "0.8em" }}
                onClick={e => { e.stopPropagation(); leaveChat(c.chatId); }}
              >
                Leave
              </button>
            </div>
          ))}
        </section>
      </aside>

      <main style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        padding: 24,
        minHeight: 0
      }}>
        {active == null ? (
          <em>Select a chat or accept an invite</em>
        ) : (
          <div style={{ flex: 1, minHeight: 0 }}>
            <ChatWindow
              title={chats.find(c => c.chatId === active)?.name || "Chat"}
              members={membersWithStatus}
              messages={history[active] || []}
              userId={uid}
              onSend={async msg => {
                await fetch("http://localhost:3030/chat/send", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ chatId: active, userId: uid, message: msg })
                });
              }}
            />
          </div>
        )}
      </main>
    </div>
  );
}