import { Routes, Route, useNavigate, Navigate, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import FeedPage from './pages/FeedPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import Layout from './pages/Layout';
import socket from './socket';
import ChatsPage from './pages/ChatsPage';
import SearchPage from './pages/SearchPage';
import UserPage from './pages/UserPage';
import SettingsPage from './pages/SettingsPage';
import UserSearchPage from './pages/UserSearchPage';
import FriendPage  from './pages/FriendPage';
import FriendsPage from "./pages/FriendsPage"; // Make sure this file exists later
import ProfilePage  from "./pages/ProfilePage";

function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isAuthenticated, setIsAuthenticated] = useState(null);

useEffect(() => {
    async function checkSession() {
      try {
        const res = await fetch("http://localhost:3030/session", {
          method: "GET",
          credentials: "include",
        });
        const data = await res.json();
        setIsAuthenticated(!!data.sessionUser);
      } catch (err) {
        console.error("Session check failed:", err);
        setIsAuthenticated(false);
      }
    }
    checkSession();
  }, [location]); // will re-run after navigate()

  /* -------------------------------------------------------------
   * 2.  Boot the websocket once we know token + userId
   * ----------------------------------------------------------- */
  useEffect(() => {
    const token  = "valid-token";                     // whatever backend checks
    const userId = localStorage.getItem("userId");
    if (userId) {
      /*  send credentials via QUERY  */
      socket.io.opts.query = { token, userId };
      socket.connect();
    }
    socket.on("connect", () => {
      console.log("WebSocket connected as", socket.id);
    });
    return () => {
      socket.off("connect");
      socket.disconnect();
    };
  }, []);

    useEffect(() => {
    socket.on("userStatus", data => console.log("userStatus:", data));
    socket.on("chatInvite", invite => console.log("chatInvite:", invite));

    return () => {
      socket.off("userStatus");
      socket.off("chatInvite");
    };
  }, []);
  
  if (isAuthenticated === null) return <p>Loading...</p>;

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/feed" element={isAuthenticated ? <FeedPage /> : <Navigate to="/login" />} />
        <Route path="/login" element={isAuthenticated ? <Navigate to="/feed" /> : <LoginPage />} />
        <Route path="/register" element={isAuthenticated ? <Navigate to="/feed" /> : <RegisterPage />} />
        <Route path="/profile"  element={<ProfilePage />} />
        <Route path="/chats" element={isAuthenticated ? <ChatsPage /> : <Navigate to="/login" />} />
        <Route path="/search" element={isAuthenticated ? <SearchPage /> : <Navigate to="/login" />} />
        <Route path="/settings" element={isAuthenticated ? <SettingsPage /> : <Navigate to="/login" />} />
        <Route path="/user/:username" element={isAuthenticated ? <FriendPage /> : <Navigate to="/login" />}/>
        <Route path="/user" element={isAuthenticated ? <UserPage /> : <Navigate to="/login" />} />
        <Route path="/friends" element={<FriendsPage />} />
        <Route path="/" element={<Navigate to={isAuthenticated ? "/feed" : "/login"} />} />
        <Route path="/users/search" element={isAuthenticated ? <UserSearchPage /> : <Navigate to="/login" />} />
      </Route>
    </Routes>
  );
}

export default App;