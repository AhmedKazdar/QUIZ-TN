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

  const validateUsername = (username) => {
    if (!username.trim()) {
      return 'Username cannot be empty';
    }
    if (username.length < 3) {
      return 'Username must be at least 3 characters long';
    }
    if (username.length > 30) {
      return 'Username cannot be longer than 30 characters';
    }
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      return 'Username can only contain letters, numbers, and underscores';
    }
    return null;
  };

  const handleUpdateUsername = async () => {
    // Validate username
    const validationError = validateUsername(newUsername);
    if (validationError) {
      toast.error(validationError);
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
      
      if (!token) {
        throw new Error('No authentication token found');
      }
      
      if (!user?._id) {
        throw new Error('User ID is missing');
      }
      
      console.log('Attempting to update username to:', newUsername);
      
      // Prepare the update data with all required fields
      const updateData = {
        username: newUsername,
        email: user.email,        // Include email as it's required
        phoneNumber: user.phoneNumber, // Include phoneNumber as it's required
        role: user.role || 'user' // Include role with a default value
      };
      
      // Call the backend API to update the user
      const response = await axios.put(
        `${import.meta.env.VITE_API_URL}/api/users/update/${user._id}`,
        updateData,
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        }
      );

      console.log('Update response:', response.data);
      
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
        console.log('Full error response:', JSON.stringify(err.response, null, 2));
      
        if (err.response.status === 400) {
          // Log the full error response for debugging
          if (err.response.data && err.response.data.message) {
            if (Array.isArray(err.response.data.message)) {
              // Join all validation messages
              errorMessage = err.response.data.message.join('. ');
            } else if (typeof err.response.data.message === 'string') {
              errorMessage = err.response.data.message;
            }
          }
          
          // Log the specific validation errors
          if (err.response.data.message && Array.isArray(err.response.data.message)) {
            console.error('Validation errors:', err.response.data.message);
          }
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
                    <div className="input-container">
                      <input
                        type="text"
                        value={newUsername}
                        onChange={(e) => {
                          const value = e.target.value;
                          setNewUsername(value);
                          // Show validation error as user types
                          const error = validateUsername(value);
                          if (error) {
                            e.target.setCustomValidity(error);
                          } else {
                            e.target.setCustomValidity('');
                          }
                        }}
                        className={`username-input ${newUsername && validateUsername(newUsername) ? 'input-error' : ''}`}
                        autoFocus
                        maxLength={30}
                        pattern="^[a-zA-Z0-9_]+$"
                        title="Username can only contain letters, numbers, and underscores"
                      />
                      {newUsername && validateUsername(newUsername) && (
                        <div className="error-message">
                          {validateUsername(newUsername)}
                        </div>
                      )}
                    </div>
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
