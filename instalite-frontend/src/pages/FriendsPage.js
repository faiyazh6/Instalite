// src/pages/FriendsPage.js
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

function FriendsPage() {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const navigate = useNavigate();

  const handleSearch = async (e) => {
    const value = e.target.value;
    setQuery(value);

    if (value.length === 0) {
      setSuggestions([]);
      return;
    }

    try {
      const res = await fetch("http://localhost:3030/user/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ query: value }),
      });

      const data = await res.json();
      if (data.users) {
        setSuggestions(data.users);
      } else {
        setSuggestions([]);
      }
    } catch (err) {
      console.error("Search failed:", err);
    }
  };

  const handleUserClick = (userId) => {
    navigate(`/user?userId=${userId}`);
  };

  return (
    <div style={{ padding: "2rem" }}>
      <h2>Find Friends</h2>
      <input
        type="text"
        value={query}
        onChange={handleSearch}
        placeholder="Search users..."
        style={{ width: "100%", padding: "0.5rem", marginBottom: "1rem" }}
      />
      {suggestions.map((user) => (
        <div
          key={user.user_id}
          onClick={() => handleUserClick(user.user_id)}
          style={{
            padding: "0.5rem",
            cursor: "pointer",
            borderBottom: "1px solid #ccc",
          }}
        >
          @{user.username}
        </div>
      ))}
    </div>
  );
}

export default FriendsPage;