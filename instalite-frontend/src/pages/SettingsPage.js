// src/SettingsPage.js
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function SettingsPage() {
  const [firstName,   setFirstName]   = useState("");
  const [lastName,    setLastName]    = useState("");
  const [username,    setUsername]    = useState("");
  const [email,       setEmail]       = useState("");
  const [affiliation, setAffiliation] = useState("");
  const [birthday,    setBirthday]    = useState("");
  const [hashtags,    setHashtags]    = useState("");
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error,       setError]       = useState("");
  const [success,     setSuccess]     = useState("");
  const [loading,     setLoading]     = useState(true);
  const navigate = useNavigate();

  // 1) Check session and load settings
  useEffect(() => {
    async function init() {
      try {
        // confirm session
        const sessRes = await fetch("http://localhost:3030/session", {
          credentials: "include"
        });
        const sessData = await sessRes.json();
        if (!sessData.sessionUser) {
          navigate("/login");
          return;
        }

        // load current settings
        const res = await fetch("http://localhost:3030/settings", {
          method: "GET",
          credentials: "include"
        });
        if (!res.ok) {
          throw new Error("Failed to load settings");
        }
        const data = await res.json();
        setFirstName(data.firstName   || "");
        setLastName( data.lastName    || "");
        setUsername( data.username    || "");
        setEmail(    data.email       || "");
        setAffiliation(data.affiliation|| "");
        setBirthday( data.birthday    || "");
        setHashtags((data.hashtags||[]).join(","));
      } catch (err) {
        console.error("Init error:", err);
        navigate("/login");
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [navigate]);

  // 2) Handle form submit
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    // build only the fields that changed
    const payload = {};
    if (firstName)    payload.firstName   = firstName;
    if (lastName)     payload.lastName    = lastName;
    if (username)     payload.username    = username;
    if (email)        payload.email       = email;
    if (affiliation)  payload.affiliation = affiliation;
    if (birthday)     payload.birthday    = birthday;
    if (hashtags)     payload.hashtags    = hashtags.split(",").map(t=>t.trim()).filter(t=>t);
    if (oldPassword || newPassword) {
      payload.oldPassword = oldPassword;
      payload.newPassword = newPassword;
    }

    try {
      const res = await fetch("http://localhost:3030/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) {
        setError((data.errors || [data.error]).join("\n"));
      } else {
        setSuccess("Settings saved!");
        setOldPassword("");
        setNewPassword("");
      }
    } catch (err) {
      console.error("Save error:", err);
      setError("Network error");
    }
  };

  if (loading) return <p>Loading...</p>;

  return (
    <div className="settings-form">
      <h2>My Settings</h2>
      {error   && <div className="error">{error}</div>}
      {success && <div className="success">{success}</div>}
      <form onSubmit={handleSubmit}>
        <input
          value={firstName}
          onChange={e => setFirstName(e.target.value)}
          placeholder="First name"
        />
        <input
          value={lastName}
          onChange={e => setLastName(e.target.value)}
          placeholder="Last name"
        />
        <input
          value={username}
          onChange={e => setUsername(e.target.value)}
          placeholder="Username"
        />
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="Email"
        />
        <input
          value={affiliation}
          onChange={e => setAffiliation(e.target.value)}
          placeholder="Affiliation"
        />
        <input
          type="date"
          value={birthday}
          onChange={e => setBirthday(e.target.value)}
        />
        <input
          value={hashtags}
          onChange={e => setHashtags(e.target.value)}
          placeholder="Hashtags (comma‑separated)"
        />
        <hr />
        <h4>Change Password</h4>
        <input
          type="password"
          value={oldPassword}
          onChange={e => setOldPassword(e.target.value)}
          placeholder="Current password"
        />
        <input
          type="password"
          value={newPassword}
          onChange={e => setNewPassword(e.target.value)}
          placeholder="New password"
        />
        <button type="submit">Save Settings</button>
      </form>
    </div>
  );
}
