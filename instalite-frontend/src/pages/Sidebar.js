import { NavLink } from "react-router-dom";
import { FaHome, FaSearch, FaPaperPlane } from "react-icons/fa";

export default function Sidebar() {
  const navItems = [
    { icon: <FaHome />, text: "Feed", path: "/feed" },
    { icon: <FaSearch />, text: "Search", path: "/search" },
    { icon: <FaPaperPlane />, text: "Chats", path: "/chats" },
    { icon: <FaUserFriends />, text: "Add/Remove Friends", path: "/friends" },  // ✅ new tab
  ];

  return (
    <div className="h-screen w-20 bg-gray-900 text-white flex flex-col items-center py-4">
      <div className="mb-8 font-bold text-lg">Logo</div>
      {navItems.map((item) => (
        <NavLink
          key={item.path}
          to={item.path}
          className={({ isActive }) =>
            `my-3 flex flex-col items-center ${
              isActive ? "font-bold text-blue-500" : "text-white"
            }`
          }
        >
          <div className="text-xl">{item.icon}</div>
          <div className="text-xs">{item.text}</div>
        </NavLink>
      ))}
    </div>
  );
}
