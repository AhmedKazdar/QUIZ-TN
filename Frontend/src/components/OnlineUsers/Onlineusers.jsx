import React, { useEffect, useState } from "react";
import socketService from "../services/socketService";

const OnlineUsers = () => {
  const [onlineUsers, setOnlineUsers] = useState([]);

  useEffect(() => {
    // Listen for online users when component mounts
    socketService.listenToOnlineUsers(setOnlineUsers);

    // Emit connection event when the component mounts
    socketService.emitConnection();

    // Clean up when the component unmounts
    return () => {
      socketService.disconnect();
    };
  }, []);

  return (
    <div>
      <h3>Online Users</h3>
      {onlineUsers.length > 0 ? (
        <ul>
          {onlineUsers.map((user, index) => (
            <li key={index}>{user}</li>
          ))}
        </ul>
      ) : (
        <p>No users online</p>
      )}
    </div>
  );
};

export default OnlineUsers;
