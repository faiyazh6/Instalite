import { useParams } from "react-router-dom";
import { useState, useEffect } from "react";

export default function OtherUserPage() {
  const { username } = useParams();
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchOtherProfile() {
      try {
        const res = await fetch("http://localhost:3030/user/profile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ username }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load profile");
        setProfile(data);
      } catch (err) {
        console.error(err);
        setError("Could not load user profile.");
      }
    }

    fetchOtherProfile();
  }, [username]);

  if (error) return <div style={{ color: "red" }}>{error}</div>;
  if (!profile) return <p>Loading...</p>;

  const { username: uname, followerCount, followingCount, posts } = profile;

  return (
    <div style={{ padding: "2rem" }}>
      <h2>@{uname}</h2>
      <p>Followers: {followerCount}</p>
      <p>Following: {followingCount}</p>

      <h3>Posts</h3>
      {Array.isArray(posts) && posts.length > 0 ? (
        posts.map((post) => (
          <div key={post.postId} style={{ border: "1px solid #ccc", padding: 10, marginBottom: 10 }}>
            <p>{post.text}</p>
            {post.imageUrl && <img src={post.imageUrl} alt="post" style={{ maxWidth: "100%" }} />}
            <small>{new Date(post.timestamp).toLocaleString()}</small>
          </div>
        ))
      ) : (
        <p>No posts yet.</p>
      )}
    </div>
  );
}
