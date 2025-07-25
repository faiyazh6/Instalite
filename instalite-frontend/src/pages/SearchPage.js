// src/pages/SearchPage.js
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Link } from "react-router-dom";


export default function SearchPage() {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [users, setUsers] = useState([]);
  const [posts, setPosts] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    async function checkSession() {
      const res = await fetch("http://localhost:3030/session", {
        credentials: "include",
      });
      const data = await res.json();
      if (!data.sessionUser) {
        navigate("/login");
      }
    }
    checkSession();
  }, [navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setAnswer("");
    setUsers([]);
    setPosts([]);
    setLoading(true);

    try {
      const res = await fetch("http://localhost:3030/search", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: question }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Chatbot failed to answer.");
      } else {
        setAnswer(data.answer);
        setUsers(data.matchedUsers || []);
        setPosts(data.matchedPosts || []);

      }
    } catch (err) {
      console.error("Search error:", err);
      setError("Could not connect to chatbot.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="search-page" style={{ padding: 20 }}>
      <h2>Ask the Chatbot</h2>
      <form onSubmit={handleSubmit} style={{ marginBottom: 20 }}>
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Type your question here..."
          required
          style={{ width: "60%", padding: 8 }}
        />
        <button type="submit" style={{ marginLeft: 10, padding: 8 }}>
          {loading ? "Thinking..." : "Ask"}
        </button>
      </form>

      {error && <div style={{ color: "red" }}>{error}</div>}

      {answer && (
        <div style={{ marginTop: 20 }}>
          <h4>Answer:</h4>
          <p>{answer}</p>
        </div>
      )}

      {users.length > 0 && (
        <div style={{ marginTop: 30 }}>
          <h4>Related Users:</h4>
          {users.map((u) => (
            <div key={u.user_id} style={{ padding: "0.5rem 0" }}>
            <Link to={`/user/${u.username}`}>@{u.username}</Link>
          </div>
          ))}
        </div>
      )}


      {posts.length > 0 && (
        <div style={{ marginTop: 30 }}>
          <h4>Related Posts:</h4>
          {posts.map((post, idx) => {
            const hashtags =
              Array.isArray(post.hashtag_text) && typeof post.hashtag_text !== "string"
                ? post.hashtag_text
                : typeof post.hashtag_text === "string"
                ? JSON.parse(post.hashtag_text || "[]")
                : [];

            return (
              <div
                key={idx}
                className="postCard"
                style={{
                  border: "1px solid #ccc",
                  padding: "1rem",
                  marginBottom: "1rem",
                  borderRadius: "8px",
                }}
              >
                <strong>@{post.author}</strong>
                <p>{post.text_content}</p>

                {hashtags.length > 0 && (
                  <div style={{ marginTop: "0.5rem" }}>
                    {hashtags.map((tag, tagIdx) => (
                      <span
                        key={tagIdx}
                        style={{
                          display: "inline-block",
                          backgroundColor: "#e0e0e0",
                          borderRadius: "12px",
                          padding: "0.2rem 0.6rem",
                          marginRight: "0.5rem",
                          fontSize: "0.8rem",
                        }}
                      >
                        {tag.startsWith("#") ? tag : `#${tag}`}
                      </span>
                    ))}
                  </div>
                )}

                {post.image_url && (
                  <>
                    <img
                      src={post.image_url}
                      alt="post"
                      style={{ maxWidth: "100%", marginTop: "0.5rem" }}
                    />
                    <br />
                  </>
                )}

                <small>
                  {new Date(post.timestamp).toLocaleString()}
                </small>

                <div style={{ marginTop: "0.3rem", fontSize: "0.85rem" }}>
                  ❤️ {post.likeCount || 0} likes
                </div>

                {/* Placeholder for comments */}
                <p style={{ fontStyle: "italic", fontSize: "0.85rem", marginTop: "0.5rem" }}>
                  (Comments unavailable in search view)
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}