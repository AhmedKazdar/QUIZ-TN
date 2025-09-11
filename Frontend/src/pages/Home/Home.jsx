import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import "./Home.css";
import { isAuthenticated } from "../../utils/auth";
import axios from "axios";
import { jwtDecode } from "jwt-decode";
import io from "socket.io-client";
import SideBar from "../../components/Sidebar/SideBar";

const Home = () => {
  const navigate = useNavigate();
  const [username, setUserName] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showModeOptions, setShowModeOptions] = useState(false);
  const [selectedMode, setSelectedMode] = useState("");
  const [countdown, setCountdown] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [error, setError] = useState(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const socketRef = useRef(null);
  const toggleMenu = () => setIsMenuOpen((prev) => !prev);
  const closeMenu = () => setIsMenuOpen(false);

  useEffect(() => {
    console.log("Running Home useEffect");

    if (!isAuthenticated()) {
      console.log("Not authenticated, redirecting to /login");
      navigate("/login", { replace: true });
      return;
    }

    const token = localStorage.getItem("token");
    const name = localStorage.getItem("username");
    const userRole = localStorage.getItem("role");

    console.log("Fetched username:", name, "Role:", userRole);
    if (name && name !== username) setUserName(name);
    if (userRole && userRole !== role) setRole(userRole);

    if (!token) {
      console.log("No token found");
      setError("No authentication token found.");
      setLoading(false);
      navigate("/login", { replace: true });
      return;
    }

    try {
      const decodedToken = jwtDecode(token);
      const currentTime = Date.now() / 1000;

      console.log("Decoded token:", decodedToken);
      if (decodedToken.exp < currentTime) {
        console.log(
          "Token expired, exp:",
          decodedToken.exp,
          "current:",
          currentTime
        );
        localStorage.clear();
        setError("Session expired, please log in again.");
        setLoading(false);
        navigate("/login", { replace: true });
        return;
      }

      // Fetch initial online users
      axios
        .get("http://localhost:3001/users/online", {
          headers: { Authorization: `Bearer ${token}` },
        })
        .then((res) => {
          console.log(
            "Fetched online users response:",
            JSON.stringify(res.data, null, 2)
          );
          const onlineList = res.data.onlineUsers || [];
          setOnlineUsers(Array.isArray(onlineList) ? onlineList : []);
          setLoading(false);
        })
        .catch((err) => {
          console.error("Fetch error:", err.response?.data || err.message);
          setError(
            "Unable to fetch online users: " +
              (err.response?.data?.message || err.message)
          );
          setLoading(false);
        });

      // Connect to Socket.io
      socketRef.current = io("http://localhost:3001", {
        auth: { token },
        reconnection: true,
      });

      socketRef.current.on("connect", () => {
        console.log("Socket.io connected:", socketRef.current.id);
      });

      socketRef.current.on("connect_error", (err) => {
        console.error("Socket.io connection error:", err.message);
        setError("Socket.io connection failed: " + err.message);
        setLoading(false);
      });

      socketRef.current.on("onlineUsers", (updatedUsers) => {
        console.log(
          "Socket.io onlineUsers event:",
          JSON.stringify(updatedUsers, null, 2)
        );
        const normalizedUsers = Array.isArray(updatedUsers)
          ? updatedUsers.map((user) =>
              typeof user === "string" ? { username: user } : user
            )
          : [];
        setOnlineUsers(normalizedUsers);
        setLoading(false);
      });

      socketRef.current.on("error", (err) => {
        console.error("Socket.io error:", err);
        setError("Socket.io error: " + (err.message || "Unknown error"));
        setLoading(false);
      });

      socketRef.current.on("reconnect", () => {
        console.log("Socket.io reconnected:", socketRef.current.id);
      });
    } catch (err) {
      console.error("Token decode or setup error:", err);
      localStorage.clear();
      setError("Invalid token or setup error.");
      setLoading(false);
      navigate("/login", { replace: true });
    }

    return () => {
      if (socketRef.current) {
        console.log("Disconnecting Socket.io");
        socketRef.current.disconnect();
      }
    };
  }, [navigate, username, role]); // Added username, role to dependencies

  useEffect(() => {
    if (selectedMode !== "online") return;

    const getNextQuizTime = () => {
      const now = new Date();
      const times = [
        new Date(now.getFullYear(), now.getMonth(), now.getDate(), 17, 15, 0),
        new Date(now.getFullYear(), now.getMonth(), now.getDate(), 20, 0, 0),
      ];
      return (
        times.find((t) => t > now) || new Date(times[0].getTime() + 86400000)
      );
    };

    let nextQuiz = getNextQuizTime();

    const interval = setInterval(() => {
      const now = new Date();
      const diff = nextQuiz - now;

      if (diff <= 0 && diff > -60000) {
        setCountdown("✅ Quiz is active now!");
        clearInterval(interval);
        navigate("/quiz", { state: { mode: "online" }, replace: true });
      } else if (diff <= -60000) {
        nextQuiz = getNextQuizTime();
      } else {
        const hours = String(Math.floor(diff / 3600000)).padStart(2, "0");
        const minutes = String(Math.floor((diff % 3600000) / 60000)).padStart(
          2,
          "0"
        );
        const seconds = String(Math.floor((diff % 60000) / 1000)).padStart(
          2,
          "0"
        );
        setCountdown(`⏳ Next quiz starts in: ${hours}:${minutes}:${seconds}`);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [selectedMode, navigate]);

  const handleLogout = () => {
    console.log("Logging out");
    localStorage.clear();
    setUserName(null);
    setRole(null);
    navigate("/login", { replace: true });
  };

  const startPracticeMode = () => {
    console.log("Starting practice mode");
    navigate("/quiz", { state: { mode: "practice" }, replace: true });
  };

  console.log("Rendering Home component");

  if (error) {
    return <div className="error-message">Error: {error}</div>;
  }
  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="dashboard-container">
      {/* Mobile Menu Toggle Button */}
      <button className="menu-toggle" onClick={toggleMenu}>
        {isMenuOpen ? '✕' : '☰'}
      </button>
      
      {/* Overlay for mobile menu */}
      <div 
        className={`overlay ${isMenuOpen ? 'active' : ''}`} 
        onClick={closeMenu}
      />
      
      {/* Sidebar */}
      <SideBar 
        username={username}
        role={role}
        isOpen={isMenuOpen}
        onLogout={() => {
          handleLogout();
          closeMenu();
        }}
      />

      {/* Main Content */}
      <div className="main-content">
        <header className="content-header">
          <div className="online-users">
            <span>Online Users: {onlineUsers.length}</span>
          </div>
        </header>

        <div className="content-body">
          {error && <div className="error-message">{error}</div>}

          {!showModeOptions ? (
            <div className="dashboard-cards">
              <div className="card">
                <h3>Quick Actions</h3>
                <div className="quick-actions">
                  <button 
                    className="primary-btn"
                    onClick={() => setShowModeOptions(true)}
                  >
                    Start New Game
                  </button>
                  {role === 'admin' && (
                    <button 
                      className="secondary-btn"
                      onClick={() => navigate("/questions")}
                    >
                      Manage Questions
                    </button>
                  )}
                </div>
              </div>

              <div className="card">
                <h3>Recent Activity</h3>
                <p>No recent activity</p>
              </div>
            </div>
          ) : (
            <div className="game-mode-options">
              <div className="card">
                <div className="card-header">
                  <h2>Select Game Mode</h2>

                </div>
                
                <div className="mode-buttons">
                  <div className="mode-card" onClick={() => setSelectedMode("solo")}>
                    <div className="mode-icon">👤</div>
                    <h3>Solo Play</h3>
                    <p>Practice on your own</p>
                  </div>
                  
                  <div className="mode-card" onClick={() => setSelectedMode("online")}>
                    <div className="mode-icon">🌐</div>
                    <h3>Online Multiplayer</h3>
                    <p>Play with others</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {selectedMode && (
            <div className="game-lobby">
              {selectedMode === "solo" ? (
                <div className="card">
                  <h2>Solo Play</h2>
                  <p>Test your knowledge in solo mode</p>
                  <button
                    className="primary-btn"
                    onClick={() => navigate("/quiz")}
                  >
                    Start Solo Quiz
                  </button>
                </div>
              ) : (
                <div className="card">
                  <h2>Online Multiplayer</h2>
                  {countdown ? (
                    <div className="countdown">
                      <h3>Starting in {countdown} seconds...</h3>
                      <div className="loading-bar">
                        <div className="loading-progress" style={{ width: `${(5 - countdown) * 20}%` }}></div>
                      </div>
                    </div>
                  ) : (
                    <div className="lobby-content">
                      <div className="player-list">
                        <h3>Players in Lobby</h3>
                        <ul>
                          {onlineUsers.length > 0 ? (
                            onlineUsers.map((user, index) => (
                              <li key={index} className="player-item">
                                <span className="player-avatar">{user.username?.charAt(0).toUpperCase()}</span>
                                <span className="player-name">{user.username}</span>
                              </li>
                            ))
                          ) : (
                            <li>No other players online</li>
                          )}
                        </ul>
                      </div>
                      <div className="lobby-actions">
                        <button
                          className="primary-btn"
                          onClick={() => setCountdown(5)}
                          disabled={onlineUsers.length < 1}
                        >
                          {onlineUsers.length > 1 ? 'Start Game' : 'Waiting for more players...'}
                        </button>
                        <button 
                          className="secondary-btn"
                          onClick={() => setSelectedMode('')}
                        >
                          Back to Modes
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default React.memo(Home);
