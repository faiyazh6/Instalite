// src/components/UserListItem.jsx
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { resolveAvatar } from '../utils/avatar';

export default function UserListItem({
  userId,
  username,
  firstName,
  lastName,
  profileImageUrl,         // ← new prop
  initiallyFollowing = false
}) {
  const [following, setFollowing] = useState(initiallyFollowing);
  const [busy, setBusy]           = useState(false);
  const [hovered, setHovered]     = useState(false);
  const [focused, setFocused]     = useState(false);

  // reuse the same helper that your feed uses:
  const avatarSrc = resolveAvatar(profileImageUrl, `@${username}`);

  const handleToggleFollow = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const method = following ? 'DELETE' : 'POST';
      const res = await fetch(
        `http://localhost:3030/users/${userId}/follow`,
        { method, credentials: 'include' }
      );
      if (res.ok) setFollowing(!following);
    } catch (err) {
      console.error(err);
    } finally {
      setBusy(false);
    }
  };

  const buttonLabel = busy ? '…' : (following ? 'Unfollow' : 'Follow');
  const buttonStyle = {
    marginLeft: 16,
    padding: '6px 12px',
    borderRadius: 4,
    border: 'none',
    cursor: busy ? 'not-allowed' : 'pointer',
    backgroundColor: following
      ? (hovered || focused ? '#ccc' : '#ddd')
      : (hovered || focused ? '#0056b3' : '#007bff'),
    color: following ? '#333' : '#fff',
    outline: focused ? '2px solid #0056b3' : 'none',
    transition: 'background-color 0.2s, outline 0.2s',
    flexShrink: 0
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: '12px 16px',
        marginBottom: 12,
        border: '1px solid #e0e0e0',
        borderRadius: 8,
        backgroundColor: '#fff',
        maxWidth: 400,
        boxSizing: 'border-box'
      }}
    >
      <Link
        to={`/user/${username}`}
        style={{
          display: 'flex',
          alignItems: 'center',
          textDecoration: 'none',
          color: 'inherit',
          flex: 1,
          minWidth: 0
        }}
      >
        <img
          src={avatarSrc}
          alt={username}
          style={{
            width: 40,
            height: 40,
            borderRadius: '50%',
            objectFit: 'cover',
            marginRight: 12,
            flexShrink: 0
          }}
        />
        <div style={{ overflow: 'hidden', minWidth: 0 }}>
          <div
            style={{
              fontWeight: 600,
              fontSize: 16,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}
          >
            {firstName} {lastName}
          </div>
          <div
            style={{
              color: '#666',
              fontSize: 14,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}
          >
            @{username}
          </div>
        </div>
      </Link>

      <button
        onClick={handleToggleFollow}
        disabled={busy}
        style={buttonStyle}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      >
        {buttonLabel}
      </button>
    </div>
  );
}