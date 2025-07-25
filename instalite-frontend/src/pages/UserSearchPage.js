// src/pages/UserSearchPage.js
import React, { useState, useEffect } from 'react';
import UserListItem from '../components/UserListItem.jsx';

export default function UserSearchPage() {
  const [query, setQuery]     = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    setLoading(true);

    fetch(`http://localhost:3030/users/search?q=${encodeURIComponent(query)}`, {
      credentials: 'include'
    })
      .then(res => {
        setLoading(false);
        if (!res.ok) {
          setResults([]);
          return [];
        }
        return res.json();
      })
      .then(data => {
        // now data items include .profileImageUrl
        setResults(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        setLoading(false);
        setResults([]);
      });
  }, [query]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '32px 16px',
        backgroundColor: '#f0f2f5',
        minHeight: '100vh',
        boxSizing: 'border-box'
      }}
    >
      <div style={{ width: '100%', maxWidth: 500 }}>
        <input
          type="text"
          placeholder="Search users"
          value={query}
          onChange={e => setQuery(e.target.value)}
          style={{
            width: '100%',
            padding: '12px 16px',
            fontSize: 18,
            borderRadius: 24,
            border: '1px solid #ccc',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            outline: 'none',
            boxSizing: 'border-box'
          }}
        />
      </div>

      {loading && (
        <div style={{ marginTop: 24, fontSize: 16, color: '#555' }}>
          Loading…
        </div>
      )}
      {!loading && results.length === 0 && query && (
        <div style={{ marginTop: 24, fontSize: 16, color: '#555' }}>
          No users found
        </div>
      )}

      <div
        style={{
          marginTop: 24,
          width: '100%',
          maxWidth: 500,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center'
        }}
      >
        {results.map(user => (
          <UserListItem
            key={user.userId}
            userId={user.userId}
            username={user.username}
            firstName={user.firstName}
            lastName={user.lastName}
            profileImageUrl={user.profileImageUrl}      // ← pass this in
            initiallyFollowing={user.initiallyFollowing}
          />
        ))}
      </div>
    </div>
  );
}