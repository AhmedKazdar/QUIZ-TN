import React, { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import "./Home.css";
import { isAuthenticated } from "../../utils/auth";
import axios from "axios";
import { jwtDecode } from "jwt-decode";
import io from "socket.io-client";
import SideBar from "../../components/Sidebar/SideBar";
import { format, parse } from 'date-fns';
import { TimePicker } from '@mui/x-date-pickers/TimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { TextField, Button, Box, Typography, List, ListItem, ListItemText, IconButton, Alert, Snackbar, CircularProgress } from '@mui/material';
import { Add as AddIcon, Delete as DeleteIcon, Edit as EditIcon } from '@mui/icons-material';
import { quizTimeService } from '../../services/quizTime.service';

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
  const [quizTimes, setQuizTimes] = useState([]);
  const [newTime, setNewTime] = useState(null);
  const [editingTime, setEditingTime] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const socketRef = useRef(null);
  const toggleMenu = () => setIsMenuOpen(prev => !prev);
  const closeMenu = () => setIsMenuOpen(false);

  const showSnackbar = (message, severity = 'success') => {
    setSnackbar({ open: true, message, severity });
  };

  const fetchQuizTimes = useCallback(async () => {
    try {
      setIsLoading(true);
      const times = await quizTimeService.getQuizTimes();
      setQuizTimes(times);
    } catch (error) {
      console.error('Error fetching quiz times:', error);
      showSnackbar('Failed to load quiz times', 'error');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleAddTime = async () => {
    if (!newTime) return;
    
    // Format the time as HH:mm
    const timeString = format(newTime, 'HH:mm');
    
    try {
      console.log('Adding quiz time:', timeString);
      const newQuizTime = await quizTimeService.addQuizTime(timeString);
      setQuizTimes([...quizTimes, newQuizTime]);
      setNewTime(null);
      showSnackbar('Quiz time added successfully');
    } catch (error) {
      console.error('Error in handleAddTime:', error);
      if (error.response?.data?.message) {
        showSnackbar(error.response.data.message, 'error');
      } else {
        showSnackbar(`Failed to add quiz time: ${error.message}`, 'error');
      }
    }
  };

  const handleDeleteTime = async (id) => {
    try {
      await quizTimeService.deleteQuizTime(id);
      setQuizTimes(quizTimes.filter(time => time._id !== id));
      showSnackbar('Quiz time removed', 'info');
    } catch (error) {
      showSnackbar('Failed to delete quiz time', 'error');
    }
  };

  const handleEditTime = (time) => {
    setEditingTime(time);
    setNewTime(parse(time.time, 'HH:mm:ss', new Date()));
  };

  const handleUpdateTime = async () => {
    if (!newTime || !editingTime) return;
    
    const timeString = format(newTime, 'HH:mm:ss');
    
    try {
      const updatedTime = await quizTimeService.updateQuizTime(editingTime._id, { time: timeString });
      setQuizTimes(quizTimes.map(time => 
        time._id === editingTime._id ? updatedTime : time
      ));
      setEditingTime(null);
      setNewTime(null);
      showSnackbar('Quiz time updated successfully');
    } catch (error) {
      if (error.response?.data?.message) {
        showSnackbar(error.response.data.message, 'error');
      } else {
        showSnackbar('Failed to update quiz time', 'error');
      }
    }
  };

  const handleCloseSnackbar = () => {
    setSnackbar({ ...snackbar, open: false });
  };

  useEffect(() => {
    console.log("Running Home useEffect");

    if (!isAuthenticated()) {
      console.log("Not authenticated, redirecting to /login");
      navigate("/login", { replace: true });
      return;
    }
    
    // Fetch quiz times when component mounts
    if (role === 'admin') {
      fetchQuizTimes();
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
        .get("http://localhost:3001/api/users/online", {
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
  }, [navigate, username, role, fetchQuizTimes]);

  useEffect(() => {
    if (selectedMode !== "online") return;

    const getNextQuizTime = () => {
      const now = new Date();
      
      // Convert quiz times to Date objects for today
      const todayTimes = quizTimes
        .filter(quizTime => quizTime.isActive !== false)
        .map(quizTime => {
          const [hours, minutes] = quizTime.time.split(':').map(Number);
          return new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate(),
            hours,
            minutes,
            0
          );
        });

      // If no active quiz times, return null
      if (todayTimes.length === 0) return null;

      // Sort times and find the next one
      todayTimes.sort((a, b) => a - b);
      const nextTime = todayTimes.find(time => time > now) || 
        new Date(todayTimes[0].getTime() + 24 * 60 * 60 * 1000); // If all passed, use first time tomorrow

      return nextTime;
    };

    let nextTime = getNextQuizTime();
    if (!nextTime) {
      setCountdown('No upcoming quizzes');
      return;
    }

    const updateCountdown = () => {
      const now = new Date();
      let diff = nextTime - now;

      // If the time has passed, get the next quiz time
      if (diff <= 0) {
        nextTime = getNextQuizTime();
        if (!nextTime) {
          setCountdown('No upcoming quizzes');
          return;
        }
        diff = nextTime - now;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setCountdown(`${hours}h ${minutes}m ${seconds}s`);
    };

    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, [selectedMode, quizTimes, navigate]);

  const startPracticeMode = useCallback(() => {
    console.log("Starting practice mode");
    navigate("/quiz", { state: { mode: "practice" }, replace: true });
  }, [navigate]);

  const handleLogout = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    localStorage.removeItem('role');
    setRole(null);
    navigate("/login", { replace: true });
  }, [navigate]);

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

              {role === 'admin' && (
                <div className="card">
                  <h3>Quiz Schedule</h3>
                  <LocalizationProvider dateAdapter={AdapterDateFns}>
                    <Box sx={{ mb: 2, display: 'flex', gap: 1, alignItems: 'center' }}>
                      <TimePicker
                        label="New quiz time"
                        value={newTime}
                        onChange={(newValue) => setNewTime(newValue)}
                        renderInput={(params) => <TextField {...params} size="small" />}
                      />
                      <Button
                        variant="contained"
                        color="primary"
                        onClick={editingTime ? handleUpdateTime : handleAddTime}
                        startIcon={<AddIcon />}
                        style={{width: '100px',height: '55px',marginBottom:'25px'}}
                        disabled={!newTime}
                        sx={{ mb: 2, display: 'flex', gap: 1, alignItems: 'center' }}
                      >
                        {editingTime ? 'Update' : 'Add'}
                      </Button>
                      {editingTime && (
                        <Button
                          variant="outlined"
                          onClick={() => {
                            setEditingTime(null);
                            setNewTime(null);
                          }}
                        >
                          Cancel
                        </Button>
                      )}
                    </Box>
                  </LocalizationProvider>
                  
                  {isLoading ? (
                    <Box display="flex" justifyContent="center" p={2}>
                      <CircularProgress size={24} />
                    </Box>
                  ) : (
                    <List dense>
                      {quizTimes.length > 0 ? (
                        quizTimes.map((quizTime) => (
                          <ListItem
                            key={quizTime._id}
                            secondaryAction={
                              <>
                                <IconButton 
                                  edge="end" 
                                  aria-label="edit"
                                  onClick={() => handleEditTime(quizTime)}
                                  size="small"
                                  sx={{ mr: 1 }}
                                >
                                  <EditIcon fontSize="small" />
                                </IconButton>
                                <IconButton 
                                  edge="end" 
                                  aria-label="delete"
                                  onClick={() => handleDeleteTime(quizTime._id)}
                                  size="small"
                                >
                                  <DeleteIcon fontSize="small" />
                                </IconButton>
                              </>
                            }
                          >
                            <ListItemText
                              primary={new Date(`2000-01-01T${quizTime.time}`).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              secondary={!quizTime.isActive ? 'Inactive' : ''}
                              style={{color:"initial"}}
                            />
                          </ListItem>
                        ))
                      ) : (
                        <Typography variant="body2" color="text.secondary" sx={{ pl: 2, py: 2 }}>
                          No quiz times scheduled
                        </Typography>
                      )}
                    </List>
                  )}
                  
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                    Next quiz: {quizTimes.length > 0 ? 
                      new Date(`2000-01-01T${quizTimes[0].time}`).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 
                      'Not scheduled'}
                  </Typography>
                </div>
              )}

              <div className="card">
                <h3>Recent Activity</h3>
                <p style={{color:"initial"}}>No recent activity</p>
              </div>
            </div>
          ) : (
            <div className="game-mode-options">
              <div className="card">
                <div className="card-header">
                  <h2 style={{color:"#4361ee"}}>Select Game Mode</h2>

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
      
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert 
          onClose={handleCloseSnackbar} 
          severity={snackbar.severity}
          variant="filled"
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </div>
  );
};

export default React.memo(Home);
