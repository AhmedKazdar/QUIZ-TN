import React, { useState, useEffect } from 'react';
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
  Slide,
  Container,
  Grid
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
  // State management
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
  
  // Menu handlers
  const toggleMenu = () => setIsMenuOpen(prev => !prev);
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

  // Animation mount effect
  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Form validation
  const validateForm = () => {
    const newErrors = {};
    if (!formData.username.trim()) newErrors.username = 'Username is required';
    
    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
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

  // Input change handler
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

  // Toggle password visibility
  const handleClickShowPassword = () => {
    setFormData(prev => ({
      ...prev,
      showPassword: !prev.showPassword
    }));
  };

  // Form submission handler
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

      await axios.post('http://localhost:3001/auth/admin/create', 
        userData,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      // Show success message and reset form
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
      const errorMessage = error.response?.data?.message || 'Failed to create account. Please try again.';
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Navigation handlers
  const handleBack = () => {
    setMounted(false);
    setTimeout(() => navigate('/'), 300);
  };
  
  const handleLogout = () => {
    localStorage.clear();
    navigate('/login', { replace: true });
  };

  // Redirect if not authenticated or not admin
  if (!isAuthenticated() || role !== 'admin') {
    navigate('/unauthorized');
    return null;
  }

  return (
    <Box className="dashboard-container" sx={{ 
      display: 'flex', 
      minHeight: '100vh',
      flexDirection: 'column',
      '@media (min-width: 600px)': {
        flexDirection: 'row'
      }
    }}>
      {/* Mobile Menu Toggle Button */}
      <IconButton 
        className="menu-toggle"
        onClick={toggleMenu}
        aria-label={isMenuOpen ? 'Close menu' : 'Open menu'}
        sx={{
          position: 'fixed',
          top: 16,
          left: 16,
          zIndex: 1200,
          display: { sm: 'none' },
          backgroundColor: 'background.paper',
          boxShadow: 1,
          '&:hover': {
            backgroundColor: 'rgba(0, 0, 0, 0.04)'
          }
        }}
      >
        {isMenuOpen ? '✕' : '☰'}
      </IconButton>
      
      {/* Overlay for mobile menu */}
      <Box 
        className={`overlay ${isMenuOpen ? 'active' : ''}`}
        onClick={closeMenu}
        aria-hidden="true"
        sx={{
          display: { sm: 'none' },
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          zIndex: 1199,
          opacity: 0,
          visibility: 'hidden',
          transition: 'opacity 0.3s, visibility 0.3s',
          '&.active': {
            opacity: 1,
            visibility: 'visible'
          }
        }}
      />
      
      {/* Sidebar */}
      <SideBar 
        username={username}
        role={role}
        isOpen={isMenuOpen}
        onLogout={handleLogout}
      />

      <Box 
        component="main"
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minHeight: '100vh',
          marginLeft: { xs: 0, sm: '240px' },
          transition: 'margin-left 0.3s',
          padding: { xs: '16px', sm: '24px', md: '32px' },
          width: '100%',
          boxSizing: 'border-box',
          backgroundColor: 'background.default',
          overflowX: 'hidden',
          '@media (min-width: 600px)': {
            padding: { xs: '24px', md: '32px' }
          }
        }}
      >
        <Container 
          maxWidth="md" 
          sx={{ 
            my: 'auto',
            width: '100%',
            padding: { xs: 0, sm: '0 16px' }
          }}
        >
          <Slide direction="up" in={mounted} mountOnEnter unmountOnExit>
            <Paper 
              elevation={3}
              sx={{
                position: 'relative',
                overflow: 'hidden',
                borderRadius: 2,
                p: { xs: 2, sm: 4 },
                backgroundColor: 'background.paper'
              }}
              component={motion.div}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              {loading && (
                <Box
                  sx={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(255, 255, 255, 0.8)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 10,
                    borderRadius: 2
                  }}
                >
                  <CircularProgress />
                </Box>
              )}
              
              <Box component="form" onSubmit={handleSubmit} noValidate>
                <Box textAlign="center" mb={{ xs: 3, sm: 4 }}>
                  <Typography 
                    variant="h4" 
                    component="h1" 
                    gutterBottom
                    sx={{
                      fontSize: { xs: '1.75rem', sm: '2.125rem' },
                      lineHeight: 1.2
                    }}
                  >
                    Create New Account
                  </Typography>
                  <Typography 
                    variant="body1" 
                    color="text.secondary"
                    sx={{
                      fontSize: { xs: '0.9rem', sm: '1rem' },
                      lineHeight: 1.5
                    }}
                  >
                    Fill in the details below to create a new user account
                  </Typography>
                </Box>

                <Grid container spacing={{ xs: 2, sm: 3 }}>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="Username"
                      name="username"
                      value={formData.username}
                      onChange={handleChange}
                      error={!!errors.username}
                      helperText={errors.username || ' '}
                      variant="outlined"
                      margin="normal"
                      size="small"
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <PersonIcon 
                              fontSize="small"
                              color={errors.username ? 'error' : 'action'} 
                            />
                          </InputAdornment>
                        ),
                      }}
                      disabled={loading}
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          height: { xs: '48px', sm: '56px' }
                        }
                      }}
                    />

                    <TextField
                      fullWidth
                      label="Email Address"
                      name="email"
                      type="email"
                      value={formData.email}
                      onChange={handleChange}
                      error={!!errors.email}
                      helperText={errors.email || ' '}
                      variant="outlined"
                      margin="normal"
                      size="small"
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <EmailIcon 
                              fontSize="small"
                              color={errors.email ? 'error' : 'action'} 
                            />
                          </InputAdornment>
                        ),
                      }}
                      disabled={loading}
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          height: { xs: '48px', sm: '56px' }
                        }
                      }}
                    />

                    <TextField
                      fullWidth
                      label="Password"
                      name="password"
                      type={formData.showPassword ? 'text' : 'password'}
                      value={formData.password}
                      onChange={handleChange}
                      error={!!errors.password}
                      helperText={errors.password || 'Minimum 6 characters'}
                      variant="outlined"
                      margin="normal"
                      size="small"
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <LockIcon 
                              fontSize="small"
                              color={errors.password ? 'error' : 'action'} 
                            />
                          </InputAdornment>
                        ),
                        endAdornment: (
                          <InputAdornment position="end">
                            <IconButton
                              aria-label="toggle password visibility"
                              onClick={handleClickShowPassword}
                              edge="end"
                              size="small"
                              sx={{
                                padding: '8px',
                                '&:hover': {
                                  backgroundColor: 'transparent'
                                }
                              }}
                            >
                              {formData.showPassword ? 
                                <VisibilityOff fontSize="small" /> : 
                                <Visibility fontSize="small" />
                              }
                            </IconButton>
                          </InputAdornment>
                        ),
                      }}
                      disabled={loading}
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          height: { xs: '48px', sm: '56px' },
                          '& fieldset': {
                            borderColor: errors.password ? 'error.main' : 'rgba(0, 0, 0, 0.23)'
                          },
                          '&:hover fieldset': {
                            borderColor: errors.password ? 'error.main' : 'rgba(0, 0, 0, 0.87)'
                          }
                        }
                      }}
                    />
                  </Grid>

                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="Phone Number (Optional)"
                      name="phoneNumber"
                      value={formData.phoneNumber}
                      onChange={handleChange}
                      error={!!errors.phoneNumber}
                      helperText={errors.phoneNumber || ' '}
                      variant="outlined"
                      margin="normal"
                      size="small"
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <PhoneIcon 
                              fontSize="small"
                              color={errors.phoneNumber ? 'error' : 'action'} 
                            />
                          </InputAdornment>
                        ),
                      }}
                      disabled={loading}
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          height: { xs: '48px', sm: '56px' }
                        }
                      }}
                    />

                    <FormControl 
                      fullWidth 
                      variant="outlined" 
                      sx={{ 
                        mt: 2, 
                        mb: 2,
                        '& .MuiOutlinedInput-root': {
                          height: { xs: '48px', sm: '56px' },
                          '& fieldset': {
                            borderColor: 'rgba(0, 0, 0, 0.23)'
                          },
                          '&:hover fieldset': {
                            borderColor: 'rgba(0, 0, 0, 0.87)'
                          }
                        }
                      }}
                    >
                      <InputLabel id="role-label" sx={{ 
                        transform: 'translate(14px, 14px) scale(1)',
                        '&.MuiInputLabel-shrink': {
                          transform: 'translate(14px, -6px) scale(0.75)'
                        }
                      }}>
                        Role
                      </InputLabel>
                      <Select
                        labelId="role-label"
                        name="role"
                        value={formData.role}
                        onChange={handleChange}
                        label="Role"
                        disabled={loading}
                        size="small"
                        sx={{
                          '& .MuiSelect-select': {
                            display: 'flex',
                            alignItems: 'center',
                            padding: { xs: '12.5px 14px', sm: '16.5px 14px' }
                          }
                        }}
                      >
                        <MenuItem value="user">User</MenuItem>
                        <MenuItem value="admin">Admin</MenuItem>
                      </Select>
                    </FormControl>

                    <Box 
                      sx={{
                        mt: 3,
                        '& button': {
                          py: { xs: 1.25, sm: 1.5 },
                          borderRadius: 2,
                          textTransform: 'none',
                          fontSize: { xs: '0.9375rem', sm: '1rem' },
                          fontWeight: 600,
                          width: '100%',
                          height: { xs: '48px', sm: '56px' },
                          '& .MuiButton-startIcon': {
                            marginRight: { xs: '6px', sm: '8px' },
                            '& > *:nth-of-type(1)': {
                              fontSize: { xs: '18px', sm: '20px' }
                            }
                          }
                        }
                      }}
                    >
                      <Button
                        type="submit"
                        variant="contained"
                        color="primary"
                        disabled={loading}
                        style={{marginTop: '1rem'}}
                        startIcon={loading ? (
                          <CircularProgress size={20} color="inherit" />
                        ) : (
                          <PersonAddIcon />
                        )}
                        sx={{
                          background: 'linear-gradient(45deg, #1976d2 30%, #2196f3 90%)',
                          '&:hover': {
                            background: 'linear-gradient(45deg, #1565c0 30%, #1e88e5 90%)',
                            boxShadow: '0 4px 8px rgba(25, 118, 210, 0.4)'
                          },
                          '&.Mui-disabled': {
                            background: 'rgba(0, 0, 0, 0.12)',
                            color: 'rgba(0, 0, 0, 0.26)'
                          },
                          '& .MuiCircularProgress-root': {
                            color: 'inherit'
                          }
                        }}
                      >
                        {loading ? 'Creating...' : 'Create User'}
                      </Button>
                    </Box>
                  </Grid>
                </Grid>
              </Box>
            </Paper>
          </Slide>
        </Container>
      </Box>
    </Box>
  );
};

export default CreateAccount;
