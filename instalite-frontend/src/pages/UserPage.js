// src/pages/UserPage.js
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { resolveAvatar } from "../utils/avatar";

export default function UserPage() {
  const [profile, setProfile]             = useState(null);
  const [error, setError]                 = useState("");
  const [commentInputs, setCommentInputs] = useState({});
  const navigate = useNavigate();

  // ─── load my profile + posts ─────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const sess = await fetch("http://localhost:3030/session", {
          credentials: "include",
        });
        const { sessionUser } = await sess.json();
        if (!sessionUser) return navigate("/login");

        const r = await fetch("http://localhost:3030/user", {
          method: "POST",
          credentials: "include",
        });
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || "Failed to load profile");

        // cache avatar
        if (data.profileImageUrl) {
          const abs = data.profileImageUrl.startsWith("http")
            ? data.profileImageUrl
            : `http://localhost:3030${data.profileImageUrl}`;
          localStorage.setItem("profileImageUrl", abs);
        }

        setProfile(data);
      } catch (err) {
        console.error(err);
        setError("Could not load profile.");
      }
    })();
  }, [navigate]);

  // ─── post a new comment ───────────────────────────────────
  const submitComment = async (postId) => {
    const text = commentInputs[postId]?.trim();
    if (!text) return;
    try {
      await fetch("http://localhost:3030/post/comment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ postId, content: text }),
      });
      setCommentInputs((p) => ({ ...p, [postId]: "" }));

      // refresh profile (so comments appear)
      const r2 = await fetch("http://localhost:3030/user", {
        method: "POST",
        credentials: "include",
      });      
      const data2 = await r2.json();
      if (!r2.ok) throw new Error(data2.error || "Reload failed");
      setProfile(data2);
    } catch (err) {
      console.error("Comment submission error:", err);
    }
  };

  // ─── delete a post ────────────────────────────────────────
  const handleDeletePost = async (postId) => {
    if (!window.confirm("Delete this post?")) return;
    try {
      const r = await fetch(`http://localhost:3030/post/${postId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!r.ok) throw new Error((await r.json()).error);
      setProfile((p) => ({
        ...p,
        posts: p.posts.filter((x) => x.postId !== postId),
      }));
    } catch (err) {
      console.error(err);
      alert("Failed to delete post.");
    }
  };

  // ─── toggle post like ─────────────────────────────────────
  const handleToggleLike = async (postId) => {
    // optimistic UI
    setProfile((p) => ({
      ...p,
      posts: p.posts.map((x) =>
        x.postId === postId
          ? { ...x, liked: !x.liked, likeCount: x.likeCount + (x.liked ? -1 : 1) }
          : x
      ),
    }));
    const post = profile.posts.find((x) => x.postId === postId);
    const method = post.liked ? "DELETE" : "POST";
    try {
      const r = await fetch(`http://localhost:3030/post/${postId}/like`, {
        method,
        credentials: "include",
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Like failed");
      // sync with server
      setProfile((p) => ({
        ...p,
        posts: p.posts.map((x) =>
          x.postId === postId
            ? { ...x, liked: d.liked, likeCount: d.likeCount }
            : x
        ),
      }));
    } catch (err) {
      console.error(err);
      // rollback
      setProfile((p) => ({
        ...p,
        posts: p.posts.map((x) =>
          x.postId === postId
            ? { ...x, liked: post.liked, likeCount: post.likeCount }
            : x
        ),
      }));
    }
  };

  // ─── toggle comment like ──────────────────────────────────
  const handleToggleCommentLike = async (commentId, isLiked) => {
    const method = isLiked ? "DELETE" : "POST";
    try {
      await fetch(`http://localhost:3030/comment/${commentId}/like`, {
        method,
        credentials: "include",
      });
      // refresh profile so comment likes update
      const r2 = await fetch("http://localhost:3030/user", {
        method: "POST",
        credentials: "include",
      });
      const data2 = await r2.json();
      if (!r2.ok) throw new Error(data2.error || "Reload failed");
      setProfile(data2);
    } catch (err) {
      console.error("Comment‐like toggle failed:", err);
    }
  };

  if (error) return <div style={{ color: "red" }}>{error}</div>;
  if (!profile) return <p>Loading…</p>;

  const { username, followerCount, followingCount, posts, profileImageUrl } = profile;
  const avatarSrc = resolveAvatar(profileImageUrl, `@${username}`);

  return (
    <div style={{ padding: "2rem" }}>
      {/* header */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
        <img
          src={avatarSrc}
          alt={`@${username}`}
          style={{ width: 100, height: 100, borderRadius: "50%", objectFit: "cover" }}
        />
        <button
          onClick={() => navigate("/profile")}
          style={{ padding: ".6rem 1.2rem", background: "#007bff", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer" }}
        >
          Change Profile Photo
        </button>
      </div>

      <h2>@{username}</h2>
      <p>Followers: {followerCount}</p>
      <p>Following: {followingCount}</p>

      <h3 style={{ marginTop: "2rem" }}>Your Posts</h3>
      {posts.length === 0 && <p>You haven't posted anything yet.</p>}

      {posts.map((post) => (
        <div
          key={post.postId}
          style={{ border: "1px solid #ccc", padding: "1rem", marginBottom: "1rem", borderRadius: 8 }}
        >
          <p>{post.text}</p>

          {post.imageUrl && (
            <img
              src={post.imageUrl.startsWith("http") ? post.imageUrl : `http://localhost:3030${post.imageUrl}`}
              alt="post"
              style={{ width: 300, marginTop: 8 }}
            />
          )}

          {post.hashtags.length > 0 && (
            <div style={{ marginTop: 8 }}>
              {post.hashtags.map((tag, i) => (
                <span
                  key={i}
                  style={{
                    display: "inline-block",
                    background: "#e0e0e0",
                    borderRadius: 12,
                    padding: "2px 8px",
                    marginRight: 6,
                    fontSize: "0.8rem",
                  }}
                >
                  {tag.startsWith("#") ? tag : `#${tag}`}
                </span>
              ))}
            </div>
          )}

          <small>{new Date(post.timestamp).toLocaleString()}</small>

          {/* post like */}
          <div style={{ marginTop: 6, fontSize: "0.85rem" }}>
            <button
              onClick={() => handleToggleLike(post.postId)}
              style={{ background: "none", border: "none", cursor: "pointer", color: post.liked ? "red" : "black" }}
            >
              ❤️ {post.likeCount}
            </button>
          </div>

          {/* comments */}
          {(post.comments || []).map((c) => (
            <div key={c.commentId} style={{ marginTop: 6, display: "flex", alignItems: "center" }}>
              <strong style={{ marginRight: 4 }}>@{c.username}</strong>
              <span style={{ flex: 1 }}>{c.text}</span>
              <button
                onClick={() => handleToggleCommentLike(c.commentId, c.liked)}
                style={{ background: "none", border: "none", cursor: "pointer", color: c.liked ? "red" : "black" }}
              >
                {c.liked ? "❤️" : "🤍"} {c.likeCount}
              </button>
            </div>
          ))}

          {/* new comment input */}
          <input
            type="text"
            placeholder="Write a comment…"
            value={commentInputs[post.postId] || ""}
            onChange={(e) =>
              setCommentInputs((p) => ({ ...p, [post.postId]: e.target.value }))
            }
            onKeyDown={(e) => e.key === "Enter" && submitComment(post.postId)}
            style={{ marginTop: 6, width: "100%", padding: "6px" }}
          />

          {/* delete post */}
          {post.author.toLowerCase() === username.toLowerCase() && (
            <button
              onClick={() => handleDeletePost(post.postId)}
              style={{
                marginTop: 6,
                background: "#ffdddd",
                border: "1px solid #ffaaaa",
                color: "#aa0000",
                padding: "4px 10px",
                borderRadius: 4,
                cursor: "pointer",
              }}
            >
              Delete Post
            </button>
          )}
        </div>
      ))}
    </div>
  );
}