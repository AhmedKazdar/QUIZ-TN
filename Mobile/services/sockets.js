// services/sockets.js
import { io } from "socket.io-client";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";

const API_URL =
  Constants.expoConfig?.extra?.API_URL || "http://192.168.1.153:3001";

let socket = null;

export const initializeSocket = async () => {
  if (socket) return socket;

  const token = await AsyncStorage.getItem("token");
  if (!token) {
    console.error("No token found for socket connection");
    return null;
  }

  socket = io(API_URL, {
    transports: ["websocket"],
    auth: { token },
  });

  socket.on("connect", () => {
    console.log("Socket connected");
  });

  socket.on("connect_error", (error) => {
    console.error("Socket connection error:", error.message);
  });

  socket.on("disconnect", () => {
    console.log("Socket disconnected");
  });

  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

/**
 * Subscribe to online users updates
 * @param {function(Array<{userId: string, username: string, socketId?: string}>): void} callback - Function to call when online users list updates
 * @returns {() => void} Unsubscribe function
 */
export const onOnlineUsers = (callback) => {
  if (!socket) {
    console.warn('Socket not initialized');
    return () => {}; // Return no-op function if socket is not available
  }
  
  socket.on("onlineUsers", callback);
  
  // Return cleanup function to remove the listener
  return () => {
    if (socket) {
      socket.off("onlineUsers", callback);
    }
  };
};
