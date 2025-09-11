import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import SideBar from '../../components/Sidebar/SideBar';
import { isAuthenticated } from '../../utils/auth';
import {
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
  InputAdornment,
  Paper,
  Typography,
  Box,
  CircularProgress,
  Fade,
  Slide
} from '@mui/material';
import {
  Person as PersonIcon,
  Email as EmailIcon,
  Lock as LockIcon,
  Phone as PhoneIcon,
  Visibility,
  VisibilityOff,
  PersonAdd as PersonAddIcon,
  ArrowBack as ArrowBackIcon
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import './CreateAccount.css';

const CreateAccount = () => {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    phoneNumber: '',
    role: 'user',
    showPassword: false
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [username, setUsername] = useState('');
  const [role, setRole] = useState('');
  const navigate = useNavigate();
  const toggleMenu = () => setIsMenuOpen((prev) => !prev);
  const closeMenu = () => setIsMenuOpen(false);

  // Get user info if authenticated
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const decoded = JSON.parse(atob(token.split('.')[1]));
        setUsername(decoded.username || '');
        setRole(decoded.role || '');
      } catch (error) {
        console.error('Error decoding token:', error);
      }
    }
  }, []);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  const validateForm = () => {
    const newErrors = {};
    if (!formData.username) newErrors.username = 'Username is required';
    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Email is invalid';
    }
    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }
    if (formData.phoneNumber && !/^\+?[0-9\s-()]{10,}$/.test(formData.phoneNumber)) {
      newErrors.phoneNumber = 'Please enter a valid phone number';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    // Clear error when user types
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: null
      }));
    }
  };

  const handleClickShowPassword = () => {
    setFormData(prev => ({
      ...prev,
      showPassword: !prev.showPassword
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    setLoading(true);
    
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Authentication required');
      }

      const userData = {
        username: formData.username.trim(),
        email: formData.email.trim(),
        password: formData.password,
        role: formData.role
      };

      // Only include phoneNumber if it's provided
      if (formData.phoneNumber) {
        userData.phoneNumber = formData.phoneNumber.trim();
      }

      const response = await axios.post('http://localhost:3001/auth/admin/create', 
        userData,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      toast.success('Account created successfully!');
      setFormData({
        username: '',
        email: '',
        password: '',
        phoneNumber: '',
        role: 'user',
        showPassword: false
      });
    } catch (error) {
      console.error('Error creating account:', error);
      const errorMessage = error.response?.data?.message || 'Failed to create account';
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    setMounted(false);
    setTimeout(() => navigate('/'), 300);
  };

  const handleLogout = () => {
    localStorage.clear();
    navigate('/login', { replace: true });
  };

  if (!isAuthenticated() || role !== 'admin') {
    navigate('/unauthorized');
    return null;
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
        <Box sx={{ position: 'relative', minHeight: '100vh', padding: '20px' }}>
          <Fade in={mounted} timeout={500}>
            <Box className="create-account-container">
              <Slide direction="up" in={mounted} mountOnEnter unmountOnExit>
                <Paper elevation={3} className="create-account-paper">
                  <IconButton 
                    onClick={handleBack}
                    sx={{
                      position: 'absolute',
                      top: '20px',
                      left: '20px',
                      zIndex: 10,
                      backgroundColor: 'white',
                      color: 'var(--primary-color)',
                      width: '48px',
                      height: '48px',
                      boxShadow: '0 2px 10px rgba(0,0,0,0.15)',
                      '&:hover': {
                        backgroundColor: 'white',
                        transform: 'scale(1.1)'
                      }
                    }}
                  >
                    <ArrowBackIcon sx={{ fontSize: '1.8rem' }} />
                  </IconButton>

                  <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="create-account-header"
                  >
              <PersonAddIcon className="header-icon" />
              <Typography variant="h4" component="h1" className="header-title">
                Create New Account
              </Typography>
              <Typography variant="body1" className="header-subtitle">
                Fill in the details to create a new user account
              </Typography>
            </motion.div>

            <motion.form 
              onSubmit={handleSubmit} 
              className="create-account-form"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              <motion.div
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.4 }}
              >
                <TextField
                  fullWidth
                  label="Username"
                  name="username"
                  value={formData.username}
                  onChange={handleChange}
                  margin="normal"
                  variant="outlined"
                  required
                  className="form-field"
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <PersonIcon className="input-icon" />
                      </InputAdornment>
                    ),
                  }}
                />
              </motion.div>

              <motion.div
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.5 }}
              >
                <TextField
                  margin="normal"
                  required
                  fullWidth
                  name="email"
                  label="Email"
                  type="email"
                  id="email"
                  autoComplete="email"
                  value={formData.email}
                  onChange={handleChange}
                  error={!!errors.email}
                  helperText={errors.email}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <EmailIcon />
                      </InputAdornment>
                    ),
                  }}
                />
              </motion.div>

              <motion.div
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.6 }}
              >
                <TextField
                  margin="normal"
                  required
                  fullWidth
                  name="password"
                  label="Password"
                  type={formData.showPassword ? 'text' : 'password'}
                  id="password"
                  autoComplete="new-password"
                  value={formData.password}
                  onChange={handleChange}
                  error={!!errors.password}
                  helperText={errors.password || 'Minimum 6 characters'}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <LockIcon />
                      </InputAdornment>
                    ),
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          aria-label="toggle password visibility"
                          onClick={handleClickShowPassword}
                          edge="end"
                        >
                          {formData.showPassword ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />
              </motion.div>

              <motion.div
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.7 }}
              >
                <TextField
                  margin="normal"
                  fullWidth
                  id="phoneNumber"
                  label="Phone Number (optional)"
                  name="phoneNumber"
                  autoComplete="tel"
                  value={formData.phoneNumber}
                  onChange={handleChange}
                  error={!!errors.phoneNumber}
                  helperText={errors.phoneNumber || 'Format: +1234567890'}
                  placeholder="+1234567890"
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <PhoneIcon />
                      </InputAdornment>
                    ),
                  }}
                />
              </motion.div>

              <motion.div
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.8 }}
              >
                <FormControl fullWidth margin="normal">
                  <InputLabel id="role-label">Role</InputLabel>
                  <Select
                    labelId="role-label"
                    id="role"
                    name="role"
                    value={formData.role}
                    label="Role"
                    onChange={handleChange}
                  >
                    <MenuItem value="user">User</MenuItem>
                    <MenuItem value="admin">Admin</MenuItem>
                  </Select>
                </FormControl>
              </motion.div>

              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.9 }}
                className="submit-container"
              >
                <Button
                  type="submit"
                  fullWidth
                  variant="contained"
                  color="primary"
                  size="large"
                  disabled={loading}
                  className="submit-button"
                  startIcon={loading ? null : <PersonAddIcon />}
                >
                  {loading ? (
                    <CircularProgress size={24} color="inherit" />
                  ) : (
                    'Create Account'
                  )}
                </Button>
              </motion.div>
            </motion.form>
          </Paper>
        </Slide>
      </Box>
    </Fade>
  </Box>
</div>
</div>
);
};

export default CreateAccount;
