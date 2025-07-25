// src/socket.js
import { io } from "socket.io-client";

// We delay connecting until after we set auth
const socket = io("http://localhost:3030", {
  autoConnect: false,
  transports: ["websocket"],
});

export default socket;
