import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaUser, FaEnvelope, FaPhone, FaUserShield, FaEdit, FaCheck, FaTimes } from 'react-icons/fa';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import SideBar from '../../components/Sidebar/SideBar';
import './Profile.css';
import axios from 'axios';

const Profile = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const navigate = useNavigate();

  const fetchUserProfile = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        navigate('/login');
        return;
      }

      const response = await axios.get('http://localhost:3001/api/users/me', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      setUser(response.data);
      setNewUsername(response.data.username || '');
    } catch (err) {
      console.error('Error fetching user profile:', err);
      setError('Failed to load profile. Please try again.');
      if (err.response?.status === 401) {
        localStorage.removeItem('token');
        navigate('/login');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUserProfile();
  }, [navigate]);

  const handleUpdateUsername = async () => {
    if (!newUsername.trim()) {
      toast.error('Username cannot be empty');
      return;
    }

    // Don't make an API call if username hasn't changed
    if (newUsername === user?.username) {
      setEditing(false);
      return;
    }

    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      // Call the backend API to update the username
      const response = await axios.put(
        `http://localhost:3001/api/users/update/${user._id}`,
        { username: newUsername },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        }
      );

      // Update the user state with the new username
      setUser(prevUser => ({
        ...prevUser,
        username: newUsername
      }));
      
      // Show success message
      toast.success('Username updated successfully!');
      
      // Exit edit mode
      setEditing(false);
      
    } catch (err) {
      console.error('Error updating username:', err);
      
      // Handle different types of errors
      let errorMessage = 'Failed to update username';
      
      if (err.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        if (err.response.status === 400) {
          errorMessage = err.response.data.message || 'Invalid username format';
        } else if (err.response.status === 401) {
          errorMessage = 'Please log in again';
          localStorage.removeItem('token');
          navigate('/login');
        } else if (err.response.status === 409) {
          errorMessage = 'Username is already taken';
        } else if (err.response.status === 500) {
          errorMessage = 'Server error. Please try again later.';
        }
      } else if (err.request) {
        // The request was made but no response was received
        errorMessage = 'No response from server. Please check your connection.';
      }
      
      toast.error(errorMessage);
      
      // Reset to the original username if update fails
      setNewUsername(user?.username || '');
      
    } finally {
      setLoading(false);
    }
  };

  const handleCancelEdit = () => {
    setNewUsername(user.username);
    setEditing(false);
  };

  if (loading) {
    return (
      <div className="app-container">
        <SideBar username={user?.username} role={user?.role} isOpen={true} />
        <div className="main-content">
          <div className="profile-container">Loading profile...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="app-container">
        <SideBar username={user?.username} role={user?.role} isOpen={true} />
        <div className="main-content">
          <div className="profile-container error">{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      <SideBar username={user?.username} role={user?.role} isOpen={true} />
      <div className="main-content">
        <div className="profile-container">
          <div className="profile-card">
            <div className="profile-header">
              <div className="profile-avatar">
                {user?.username?.charAt(0).toUpperCase() || 'U'}
              </div>
              <div className="username-edit-container">
                {editing ? (
                  <div className="username-edit-input">
                    <input
                      type="text"
                      value={newUsername}
                      onChange={(e) => setNewUsername(e.target.value)}
                      className="username-input"
                      autoFocus
                    />
                    <button 
                      onClick={handleUpdateUsername} 
                      className="btn-icon btn-success"
                      title="Save"
                    >
                      <FaCheck />
                    </button>
                    <button 
                      onClick={handleCancelEdit} 
                      className="btn-icon btn-danger"
                      title="Cancel"
                    >
                      <FaTimes />
                    </button>
                  </div>
                ) : (
                  <h2>
                    {user?.username || 'User'}
                    <button 
                      onClick={() => setEditing(true)} 
                      className="btn-icon btn-edit"
                      title="Edit username"
                    >
                      <FaEdit />
                    </button>
                  </h2>
                )}
              </div>
            </div>

            <div className="profile-details">
              <div className="detail-item">
                <FaUser className="detail-icon" />
                <div>
                  <span className="detail-label">Username</span>
                  <span className="detail-value">{user?.username || 'N/A'}</span>
                </div>
              </div>

              <div className="detail-item">
                <FaEnvelope className="detail-icon" />
                <div>
                  <span className="detail-label">Email</span>
                  <span className="detail-value">{user?.email || 'N/A'}</span>
                </div>
              </div>

              {user?.phoneNumber && (
                <div className="detail-item">
                  <FaPhone className="detail-icon" />
                  <div>
                    <span className="detail-label">Phone</span>
                    <span className="detail-value">{user.phoneNumber}</span>
                  </div>
                </div>
              )}
            </div>

            <div className="profile-stats">
              <div className="stat-item">
                <span className="stat-value">{user?.stats?.quizzesTaken || 0}</span>
                <span className="stat-label">Quizzes Taken</span>
              </div>
              <div className="stat-item">
                <span className="stat-value">{user?.stats?.averageScore || 0}%</span>
                <span className="stat-label">Average Score</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
