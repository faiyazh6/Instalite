// src/pages/Layout.js
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { useState } from "react";

export default function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const userId = Number(localStorage.getItem("userId"));
  const [menuOpen, setMenuOpen] = useState(false);

  // paths where we DO NOT want the sidebar
  const noSidebar = ["/login", "/register", "/profile", "/pick-photo"];

  // if we're on a no-sidebar path, just render the page content
  if (noSidebar.includes(location.pathname)) {
    return <Outlet />;
  }

  const handleLogout = async () => {
    await fetch("http://localhost:3030/logout", {
      method: "POST",
      credentials: "include",
    });
    localStorage.clear();
    window.location.href = "/login";
  };

  // sidebar sizes
  const SIDEBAR_WIDTH = 100;
  const ICON_SIZE    = 32;
  const PROFILE_SIZE = 40;

  const iconStyle = {
    width: ICON_SIZE,
    height: ICON_SIZE,
    cursor: "pointer",
    display: "block",
    marginBottom: 24,
  };

  // show either saved avatar or default endpoint
  const stored = localStorage.getItem("profileImageUrl");
  const profileImageUrl = stored
    ? stored
    : `http://localhost:3030/users/${userId}/image`;

  return (
    <div style={{ display: "flex", height: "100vh" }}>
      <aside
        style={{
          width: SIDEBAR_WIDTH,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          paddingTop: 24,
          paddingBottom: 24,
          borderRight: "1px solid #ddd",
          boxSizing: "border-box",
        }}
      >
        {/* Logo */}
        <img
          src="/icons/logo.svg"
          alt="Logo"
          style={iconStyle}
          onClick={() => navigate("/feed")}
        />

        {/* Home */}
        <img
          src="/icons/home.svg"
          alt="Home"
          style={iconStyle}
          onClick={() => navigate("/feed")}
        />

        {/* Search */}
        <img
          src="/icons/search.svg"
          alt="Search"
          style={iconStyle}
          onClick={() => navigate("/search")}
        />

        {/* Create Post */}
        <img
          src="/icons/create_post.svg"
          alt="Create Post"
          style={iconStyle}
          onClick={() => navigate("/feed?create=true")}
        />

        {/* Friends */}
        <img
          src="/icons/search_users.svg"
          alt="Search Users"
          style={iconStyle}
          onClick={() => navigate("/users/search")}
        />

        {/* Chats */}
        <img
          src="/icons/send.svg"
          alt="Chats"
          style={iconStyle}
          onClick={() => navigate("/chats")}
        />

        {/* spacer */}
        <div style={{ flexGrow: 1 }} />

        {/* Profile avatar */}
        <img
          src={profileImageUrl}
          alt="Your profile"
          onClick={() => navigate("/user")}
          style={{
            width: PROFILE_SIZE,
            height: PROFILE_SIZE,
            borderRadius: "50%",
            cursor: "pointer",
            objectFit: "cover",
            marginBottom: 16,
          }}
        />

        {/* Hamburger + dropdown */}
        <div style={{ position: "relative", marginBottom: 16 }}>
          <img
            src="/icons/menu.svg"
            alt="Menu"
            style={{ width: ICON_SIZE, height: ICON_SIZE, cursor: "pointer" }}
            onClick={() => setMenuOpen((o) => !o)}
          />

          {menuOpen && (
            <div
              style={{
                position: "absolute",
                top: "50%",
                left: "100%",
                transform: "translate(8px, -50%)",
                background: "#fff",
                borderRadius: 12,
                boxShadow: "0 4px 16px rgba(0,0,0,0.1)",
                overflow: "hidden",
                minWidth: 200,
                zIndex: 100,
              }}
            >
              {/* Settings */}
              <div
                onClick={() => {
                  setMenuOpen(false);
                  navigate("/settings");
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  padding: "12px 16px",
                  cursor: "pointer",
                }}
              >
                <img
                  src="/icons/settings.svg"
                  alt=""
                  style={{ width: 20, height: 20, marginRight: 12 }}
                />
                Settings
              </div>
              <div style={{ height: 1, background: "#eee" }} />

              {/* Log out */}
              <div
                onClick={handleLogout}
                style={{
                  padding: "12px 16px",
                  cursor: "pointer",
                }}
              >
                Log out
              </div>
            </div>
          )}
        </div>
      </aside>

      <main style={{ flex: 1, overflow: "auto" }}>
        <Outlet />
      </main>
    </div>
  );
}