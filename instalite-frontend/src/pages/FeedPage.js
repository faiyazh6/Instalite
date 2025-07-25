import React, { useState, useEffect, useRef  } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import { resolveAvatar } from "../utils/avatar";

export default function FeedPage() {
  const [posts, setPosts]                   = useState([]);
  const [currentUsername, setCurrentUsername] = useState("");
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState(null);
  const [showModal, setShowModal]         = useState(false);
  const [textContent, setTextContent]     = useState("");
  const [hashtags,   setHashtags]         = useState("");
  const [imageFile,  setImageFile]        = useState(null);
  const [commentInputs, setCommentInputs] = useState({});


  const LIMIT = 10;
const [page, setPage] = useState(0);
const [hasMore, setHasMore] = useState(true);
const [loadingPage, setLoadingPage] = useState(false);
const sentinelRef = useRef();


  const navigate = useNavigate();
  const location = useLocation();

  // open create-post modal if ?create=true
  useEffect(() => {
    const p = new URLSearchParams(location.search);
    if (p.get("create") === "true") {
      setShowModal(true);
      navigate("/feed", { replace: true });
    }
  }, [location, navigate]);

  // load session & feed
  useEffect(() => {
    async function checkSessionAndInit() {
      try {
        const sess = await fetch("http://localhost:3030/session", { credentials:"include" });
        const { sessionUser } = await sess.json();
        if (!sessionUser) return navigate("/login");
        setCurrentUsername(sessionUser.username);
        setLoading(false);
        setPage(0);
        loadPage(0, true);
      } catch (err) {
        console.error(err);
        setError("Could not connect to server.");
      }
    }
    checkSessionAndInit();
  }, [navigate]);

  const loadPage = async (pageNum, isInit = false) => {
    setLoadingPage(true);
    if (isInit) {
      setPosts([]);
      setHasMore(true);
    }
    try {
      const r = await fetch("http://localhost:3030/feed", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: LIMIT, offset: pageNum * LIMIT }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Feed failed");
      if (isInit) {
        setPosts(data);
      } else {
        setPosts(prev => [...prev, ...data]);
      }
      if (data.length < LIMIT) setHasMore(false);
    } catch (err) {
      console.error(err);
      setError("Could not load feed");
    } finally {
      setLoadingPage(false);
    }
  };

  useEffect(() => {
    if (page === 0) return;
    loadPage(page);
  }, [page]);

  useEffect(() => {
    if (!sentinelRef.current || !hasMore || loadingPage) return;
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) setPage(p => p + 1);
    }, { rootMargin: "200px" });
    obs.observe(sentinelRef.current);
    return () => obs.disconnect();
  }, [hasMore, loadingPage]);
  

  /* ── create post ─────────────────────────────────────────────────────────── */
  const handlePostSubmit = async (e) => {
    e.preventDefault();
    const form = new FormData();
    form.append("text_content", textContent);
    form.append(
      "hashtag_text",
      JSON.stringify(hashtags.split(",").map((t) => t.trim()).filter(Boolean))
    );
    if (imageFile) form.append("image", imageFile);

    try {
      await axios.post("http://localhost:3030/post/create", form, { withCredentials: true });
      setTextContent("");
      setHashtags("");
      setImageFile(null);
      setShowModal(false);
      // reload feed
      const r = await fetch("http://localhost:3030/feed", {
        method: "POST",
        credentials: "include",
      });
      setPosts(await r.json());
    } catch (err) {
      console.error(err);
      alert("Error creating post.");
    }
  };

  // submit comment
  const handleSubmitComment = async (postId) => {
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
      // reload feed
      const r = await fetch("http://localhost:3030/feed", {
        method: "POST",
        credentials: "include",
      });
      setPosts(await r.json());
    } catch (err) {
      console.error(err);
    }
  };

  // delete post
  const handleDeletePost = async (postId) => {
    if (!window.confirm("Delete this post?")) return;
    try {
      const res = await fetch(`http://localhost:3030/post/${postId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setPosts((p) => p.filter((x) => x.postId !== postId));
    } catch (err) {
      console.error(err);
      alert("Failed to delete post.");
    }
  };

  // toggle post like
  const handleToggleLike = async (postId, isLiked) => {
    const method = isLiked ? "DELETE" : "POST";
    try {
      await fetch(`http://localhost:3030/post/${postId}/like`, {
        method,
        credentials: "include",
      });
      // reload feed
      const r = await fetch("http://localhost:3030/feed", {
        method: "POST",
        credentials: "include",
      });
      setPosts(await r.json());
    } catch (err) {
      console.error(err);
    }
  };

  // toggle comment like
  const handleToggleCommentLike = async (commentId, isLiked) => {
    const method = isLiked ? "DELETE" : "POST";
    try {
      await fetch(`http://localhost:3030/comment/${commentId}/like`, {
        method,
        credentials: "include",
      });
      // reload feed to pick up updated comment.likeCount/liked
      const r = await fetch("http://localhost:3030/feed", {
        method: "POST",
        credentials: "include",
      });
      setPosts(await r.json());
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) return <p>Loading posts…</p>;
  if (error) return <p style={{ color: "red" }}>{error}</p>;

  return (
    <div style={{ padding: "2rem" }}>
      <h2>Welcome to your Feed</h2>
      <hr />

      {posts.length === 0 ? (
        <p>No live posts yet.</p>
      ) : (
        posts.map((post) => {
          const avatar = resolveAvatar(post.profileImageUrl, `@${post.author}`);
          const tags = Array.isArray(post.hashtags) ? post.hashtags : [];

          return (
            <div
              key={post.postId}
              style={{
                border: "1px solid #ccc",
                padding: "1rem",
                marginBottom: "1rem",
                borderRadius: 8,
              }}
            >
              {/* avatar + author */}
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <img
                  src={avatar}
                  alt={`@${post.author}`}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: "50%",
                    objectFit: "cover",
                  }}
                />
                <strong>
                  <Link to={`/user/${post.author}`}>@{post.author}</Link>
                </strong>
              </div>

              <p style={{ marginTop: 8 }}>{post.text}</p>

              {tags.length > 0 && (
                <div style={{ marginTop: 4 }}>
                  {tags.map((t, i) => (
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
                      {t.startsWith("#") ? t : `#${t}`}
                    </span>
                  ))}
                </div>
              )}

              {post.imageUrl && (
                <img
                  src={
                    post.imageUrl.startsWith("http")
                      ? post.imageUrl
                      : `http://localhost:3030${post.imageUrl}`
                  }
                  alt="post"
                  style={{ display: "block", width: 300, marginTop: 8 }}
                />
              )}

              <small>{new Date(post.timestamp).toLocaleString()}</small>

              {/* post like */}
              <div style={{ marginTop: 6, fontSize: "0.85rem" }}>
                <button
                  onClick={() => handleToggleLike(post.postId, post.liked)}
                  style={{
                    background: "#fff",
                    border: "1px solid #ccc",
                    color: post.liked ? "red" : "gray",
                    padding: "4px 10px",
                    borderRadius: 4,
                    cursor: "pointer",
                  }}
                >
                  {post.liked ? "❤️" : "🤍"}
                </button>{" "}
                {post.likeCount || 0} likes
              </div>

              {/* comments */}
              {(post.comments || []).length > 0 ? (
                post.comments.map((c) => (
                  <div
                    key={c.commentId}
                    style={{
                      marginTop: 6,
                      fontSize: "0.85rem",
                      display: "flex",
                      alignItems: "center",
                    }}
                  >
                    <strong style={{ marginRight: 4 }}>
                      <Link to={`/user/${c.username}`}>@{c.username}</Link>
                    </strong>
                    <span style={{ flex: 1 }}>{c.text}</span>
                    <button
                      onClick={() =>
                        handleToggleCommentLike(c.commentId, c.liked)
                      }
                      style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        color: c.liked ? "red" : "gray",
                      }}
                    >
                      {c.liked ? "❤️" : "🤍"} {c.likeCount || 0}
                    </button>
                  </div>
                ))
              ) : (
                <p
                  style={{
                    fontStyle: "italic",
                    fontSize: "0.85rem",
                    marginTop: 6,
                  }}
                >
                  Be the first to comment…
                </p>
              )}

              {/* new comment input */}
              <input
                type="text"
                placeholder="Write a comment…"
                value={commentInputs[post.postId] || ""}
                onChange={(e) =>
                  setCommentInputs((p) => ({
                    ...p,
                    [post.postId]: e.target.value,
                  }))
                }
                onKeyDown={(e) =>
                  e.key === "Enter" && handleSubmitComment(post.postId)
                }
                style={{ marginTop: 6, width: "100%", padding: "6px" }}
              />

              {/* delete post */}
              {post.author.toLowerCase() ===
                currentUsername.toLowerCase() && (
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
          );
        })
      )}

{hasMore && <div ref={sentinelRef} style={{ height: 1 }} />}
{loadingPage && <p>Loading more posts…</p>}

      {/* floating ➕ button */}
      <button onClick={() => setShowModal(true)}
              style={{ position:"fixed", bottom:30, right:30,
                       fontSize:"2rem", padding:"10px 20px" }}>➕</button>

      {/* create-post modal */}
      {showModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <div
            style={{
              background: "#fff",
              padding: 20,
              borderRadius: 8,
              width: 300,
            }}
          >
            <h3>Create a Post</h3>
            <form onSubmit={handlePostSubmit}>
              <textarea
                value={textContent}
                onChange={(e) => setTextContent(e.target.value)}
                placeholder="What's on your mind?"
                style={{ width: "100%" }}
              />
              <input
                type="text"
                value={hashtags}
                onChange={(e) => setHashtags(e.target.value)}
                placeholder="Hashtags comma-separated"
                style={{ width: "100%", marginTop: 8 }}
              />
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setImageFile(e.target.files[0])}
                style={{ marginTop: 8 }}
              />
              <div style={{ marginTop: 10 }}>
                <button type="submit">Post</button>{" "}
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}