import React, { useEffect, useState } from "react";
import { getLeaderboard, getUserRank } from "../../services/rankingService";
import { FaTrophy, FaUser, FaMedal, FaBars } from "react-icons/fa";
import { motion } from "framer-motion";
import SideBar from "../../components/Sidebar/SideBar";
import "./Ranking.css";

const Ranking = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [leaderboard, setLeaderboard] = useState([]);
  const [userRank, setUserRank] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Get user data from localStorage
  const currentUser = {
    _id: localStorage.getItem('userId'),
    username: localStorage.getItem('username'),
    role: localStorage.getItem('role') || 'user',
    email: localStorage.getItem('email'),
    phoneNumber: localStorage.getItem('phoneNumber')
  };
  const userRole = currentUser.role;

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        // Fetch leaderboard data
        const leaderboardData = await getLeaderboard(currentPage, itemsPerPage);
        setLeaderboard(leaderboardData.leaderboard || []);
        
        // Fetch current user's rank if logged in
        if (currentUser?._id) {
          try {
            const rankData = await getUserRank(currentUser._id);
            setUserRank(rankData);
          } catch (rankError) {
            console.warn('Could not fetch user rank:', rankError);
          }
        }
      } catch (err) {
        console.error('Error fetching ranking data:', err);
        setError('Failed to load ranking data. Please try again later.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [currentPage, currentUser?._id]);

  const getMedalColor = (rank) => {
    switch (rank) {
      case 1: return '#FFD700'; // Gold
      case 2: return '#C0C0C0'; // Silver
      case 3: return '#CD7F32'; // Bronze
      default: return '#4A90E2'; // Blue for others
    }
  };

  const handlePageChange = (newPage) => {
    setCurrentPage(prev => Math.max(1, Math.min(prev + newPage, 10))); // Assuming max 10 pages for now
  };

  if (isLoading) {
    return (
      <div className="ranking-loading">
        <div className="loading-spinner"></div>
        <p>Loading rankings...</p>
      </div>
    );
  }

  // Show placeholder data if there's an error or no data
  const displayData = error || leaderboard.length === 0 ? [
    { userId: '1', username: 'User 1', score: 0, rank: 1 },
    { userId: '2', username: 'User 2', score: 0, rank: 2 },
    { userId: '3', username: 'User 3', score: 0, rank: 3 },
  ] : leaderboard;

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login';
  };


  return (
    <div className="app-layout">
      <SideBar 
        username={currentUser?.username}
        role={userRole}
        isOpen={isSidebarOpen}
        onToggle={toggleSidebar}
        onClose={() => setIsSidebarOpen(false)}
        onLogout={handleLogout}
      />
      <div className="main-content">
        <button className="sidebar-toggle" onClick={toggleSidebar}>
          <FaBars />
        </button>
        <div className="ranking-container">
      <div className="ranking-header">
        <h1><FaTrophy className="header-icon" /> Leaderboard</h1>
        {userRank && (
          <div className="user-rank-badge">
            <FaUser className="user-icon" />
            <span>Your Rank: <strong>#{userRank.rank}</strong> of {userRank.totalUsers}</span>
          </div>
        )}
      </div>

      <div className="ranking-list">
        {displayData.map((entry, index) => (
          <motion.div 
            key={entry.userId} 
            className={`ranking-item ${index < 3 ? 'top-three' : ''}`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <div className="rank-badge" style={{ backgroundColor: getMedalColor(index + 1) }}>
              {index < 3 ? (
                <FaMedal className="medal-icon" />
              ) : (
                <span className="rank-number">{index + 1}</span>
              )}
            </div>
            <div className="user-info">
              <span className="username">{entry.username || 'Anonymous'}</span>
              {index === 0 && <span className="champion-badge">Champion</span>}
            </div>
            <div className="score">{entry.score} pts</div>
          </motion.div>
        ))}
      </div>

      {!error && leaderboard.length > 0 && (
        <div className="pagination">
          <button 
            onClick={() => handlePageChange(-1)} 
            disabled={currentPage === 1}
            className="pagination-button"
          >
            Previous
          </button>
          <span className="page-info">
            Page {currentPage}
          </span>
          <button 
            onClick={() => handlePageChange(1)}
            disabled={leaderboard.length < itemsPerPage}
            className="pagination-button"
          >
            Next
          </button>
        </div>
      )}
        </div>
      </div>
    </div>
  );
};

export default Ranking;
