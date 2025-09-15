import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import ReactCountryFlag from 'react-country-flag';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import SideBar from '../../components/Sidebar/SideBar';
import { isAuthenticated, getCurrentUser, clearAuthData } from '../../utils/auth';
import socketService from '../../services/socketService';
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
  Grid,
  InputBase,
  Select as MuiSelect,
  FormHelperText
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

// List of common country codes with flags and dial codes
const countryCodes = [
  { code: 'TN', dialCode: '+216', name: 'Tunisia' },
  { code: 'US', dialCode: '+1', name: 'United States' },
  { code: 'GB', dialCode: '+44', name: 'United Kingdom' },
  { code: 'FR', dialCode: '+33', name: 'France' },
  { code: 'DE', dialCode: '+49', name: 'Germany' },
  { code: 'IT', dialCode: '+39', name: 'Italy' },
  { code: 'ES', dialCode: '+34', name: 'Spain' },
  { code: 'CA', dialCode: '+1', name: 'Canada' },
  { code: 'DZ', dialCode: '+213', name: 'Algeria' },
  { code: 'MA', dialCode: '+212', name: 'Morocco' },
  { code: 'LY', dialCode: '+218', name: 'Libya' },
  { code: 'EG', dialCode: '+20', name: 'Egypt' },
  { code: 'SA', dialCode: '+966', name: 'Saudi Arabia' },
  { code: 'AE', dialCode: '+971', name: 'UAE' },
  { code: 'QA', dialCode: '+974', name: 'Qatar' },
  { code: 'KW', dialCode: '+965', name: 'Kuwait' },
  { code: 'BH', dialCode: '+973', name: 'Bahrain' },
  { code: 'OM', dialCode: '+968', name: 'Oman' },
  { code: 'JO', dialCode: '+962', name: 'Jordan' },
  { code: 'LB', dialCode: '+961', name: 'Lebanon' },
  { code: 'IQ', dialCode: '+964', name: 'Iraq' },
  { code: 'SY', dialCode: '+963', name: 'Syria' },
  { code: 'YE', dialCode: '+967', name: 'Yemen' },
  { code: 'TR', dialCode: '+90', name: 'Turkey' },
  { code: 'RU', dialCode: '+7', name: 'Russia' },
  { code: 'CN', dialCode: '+86', name: 'China' },
  { code: 'JP', dialCode: '+81', name: 'Japan' },
  { code: 'KR', dialCode: '+82', name: 'South Korea' },
  { code: 'IN', dialCode: '+91', name: 'India' },
  { code: 'BR', dialCode: '+55', name: 'Brazil' },
  { code: 'AU', dialCode: '+61', name: 'Australia' },
  { code: 'NZ', dialCode: '+64', name: 'New Zealand' },
  { code: 'ZA', dialCode: '+27', name: 'South Africa' },
  { code: 'NG', dialCode: '+234', name: 'Nigeria' },
  { code: 'KE', dialCode: '+254', name: 'Kenya' },
  { code: 'ET', dialCode: '+251', name: 'Ethiopia' },
  { code: 'GH', dialCode: '+233', name: 'Ghana' },
  { code: 'SN', dialCode: '+221', name: 'Senegal' },
  { code: 'CI', dialCode: '+225', name: 'Ivory Coast' },
  { code: 'CM', dialCode: '+237', name: 'Cameroon' }
];

const CreateAccount = () => {
  // State management
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    phoneNumber: '',
    countryCode: '+216', // Default to Tunisia
    role: 'admin',
    showPassword: false,
    showConfirmPassword: false
  });
  
  const [errors, setErrors] = useState({
    username: '',
    email: '',
    phoneNumber: '',
    password: '',
    confirmPassword: ''
  });
  const [loading, setLoading] = useState(false);
  const [checkingDuplicates, setCheckingDuplicates] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [username, setUsername] = useState('');
  const [role, setRole] = useState('');
  const [onlineUsers, setOnlineUsers] = useState([]);
  
  // API call to check if username exists
  const checkUsernameExists = async (username) => {
    try {
      const response = await axios.get(`${import.meta.env.VITE_API_URL}/api/users/check-username`, {
        params: { username }
      });
      return response.data.exists;
    } catch (error) {
      console.error('Error checking username:', error);
      return false;
    }
  };
  
  // API call to check if email exists
  const checkEmailExists = async (email) => {
    try {
      const response = await axios.get(`${import.meta.env.VITE_API_URL}/api/users/check-email`, {
        params: { email }
      });
      return response.data.exists;
    } catch (error) {
      console.error('Error checking email:', error);
      return false;
    }
  };
  
  // API call to check if phone number exists
  const checkPhoneNumberExists = async (phoneNumber) => {
    try {
      const response = await axios.get(`${import.meta.env.VITE_API_URL}/api/users/check-phone`, {
        params: { phoneNumber: `${formData.countryCode}${phoneNumber}` }
      });
      return response.data.exists;
    } catch (error) {
      console.error('Error checking phone number:', error);
      return false;
    }
  };
  
  const navigate = useNavigate();
  
  // Menu handlers
  const toggleMenu = () => setIsMenuOpen(prev => !prev);
  const closeMenu = () => setIsMenuOpen(false);
  
  // Handle WebSocket connection and user authentication
  useEffect(() => {
    let isMounted = true;
    
    const handleStorageChange = (e) => {
      if (e.key === 'token') {
        if (!e.newValue) {
          // Token was removed
          if (socketService && typeof socketService.disconnect === 'function') {
            socketService.disconnect();
          }
          clearAuthData();
          navigate('/login');
        } else if (e.oldValue !== e.newValue) {
          // Token changed, reinitialize
          initializeAuthAndWebSocket();
        }
      }
    };
    
    const initializeAuthAndWebSocket = async () => {
      try {
        const token = localStorage.getItem('token');
        const user = getCurrentUser();
        
        if (!token || !user) {
          clearAuthData();
          navigate('/login');
          return;
        }
        
        if (isMounted) {
          setUsername(user.username || user.sub);
          setRole(user.role);
        }
        
        // Initialize WebSocket if not already connected
        if (socketService && typeof socketService.isConnected === 'function' && !socketService.isConnected()) {
          try {
            await socketService.initialize();
            console.log('WebSocket connected successfully');
          } catch (wsError) {
            console.warn('WebSocket connection failed (non-critical):', wsError);
          }
        }
      } catch (error) {
        console.error('Authentication check failed:', error);
        clearAuthData();
        navigate('/login');
      }
    };
    
    // Initial check
    initializeAuthAndWebSocket();
    
    window.addEventListener('storage', handleStorageChange);
    
    return () => {
      isMounted = false;
      window.removeEventListener('storage', handleStorageChange);
      // Don't disconnect WebSocket here as it might be used by other components
    };
  }, [navigate]);

  // Animation mount effect
  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Form validation
  const validateForm = async () => {
    const newErrors = {};
    let hasErrors = false;
    
    // Username validation
    if (!formData.username.trim()) {
      newErrors.username = 'Username is required';
      hasErrors = true;
    } else if (!/^[a-zA-Z0-9_]+$/.test(formData.username)) {
      newErrors.username = 'Only letters, numbers, and underscores allowed';
      hasErrors = true;
    } else if (formData.username.length < 3 || formData.username.length > 30) {
      newErrors.username = 'Must be 3-30 characters';
      hasErrors = true;
    } else {
      // Check if username already exists
      setCheckingDuplicates(true);
      const usernameExists = await checkUsernameExists(formData.username);
      setCheckingDuplicates(false);
      if (usernameExists) {
        newErrors.username = 'Username is already taken';
        hasErrors = true;
      }
    }
    
    // Email validation
    if (!formData.email) {
      newErrors.email = 'Email is required';
      hasErrors = true;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email';
      hasErrors = true;
    } else {
      // Check if email already exists
      setCheckingDuplicates(true);
      const emailExists = await checkEmailExists(formData.email);
      setCheckingDuplicates(false);
      if (emailExists) {
        newErrors.email = 'Email is already registered';
        hasErrors = true;
      }
    }
    
    // Phone number validation
    if (!formData.phoneNumber) {
      newErrors.phoneNumber = 'Phone number is required';
      hasErrors = true;
    } else if (!/^\d{5,15}$/.test(formData.phoneNumber)) {
      newErrors.phoneNumber = 'Please enter a valid phone number (5-15 digits)';
      hasErrors = true;
    } else {
      // Check if phone number already exists
      setCheckingDuplicates(true);
      const phoneExists = await checkPhoneNumberExists(formData.phoneNumber);
      setCheckingDuplicates(false);
      if (phoneExists) {
        newErrors.phoneNumber = 'Phone number is already registered';
        hasErrors = true;
      }
    }
    
    // Password validation
    if (!formData.password) {
      newErrors.password = 'Password is required';
      hasErrors = true;
    } else if (formData.password.length < 6) {
      newErrors.password = 'At least 6 characters';
      hasErrors = true;
    } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[^A-Za-z0-9])/.test(formData.password)) {
      newErrors.password = 'Needs upper, lower, number, special char';
      hasErrors = true;
    }
    
    // Confirm password validation
    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
      hasErrors = true;
    }
    
    setErrors(newErrors);
    return !hasErrors;
  };

  // Input change handler
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
    
    // Validate on the fly for better UX
    if (name === 'username') {
      if (!value) {
        setErrors(prev => ({ ...prev, username: 'Username is required' }));
      } else if (!/^[a-zA-Z0-9_]+$/.test(value)) {
        setErrors(prev => ({ ...prev, username: 'Only letters, numbers, and underscores allowed' }));
      } else if (value.length < 3 || value.length > 30) {
        setErrors(prev => ({ ...prev, username: 'Must be 3-30 characters' }));
      } else {
        setErrors(prev => ({ ...prev, username: '' }));
      }
    } else if (name === 'email') {
      if (!value) {
        setErrors(prev => ({ ...prev, email: 'Email is required' }));
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        setErrors(prev => ({ ...prev, email: 'Please enter a valid email' }));
      } else {
        setErrors(prev => ({ ...prev, email: '' }));
      }
    } else if (name === 'phoneNumber') {
      if (!value) {
        setErrors(prev => ({ ...prev, phoneNumber: 'Phone number is required' }));
      } else if (!/^\d{5,15}$/.test(value)) {
        setErrors(prev => ({ ...prev, phoneNumber: 'Please enter a valid phone number' }));
      } else {
        setErrors(prev => ({ ...prev, phoneNumber: '' }));
      }
    } else if (name === 'password') {
      if (!value) {
        setErrors(prev => ({ ...prev, password: 'Password is required' }));
      } else if (value.length < 6) {
        setErrors(prev => ({ ...prev, password: 'At least 6 characters' }));
      } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[^A-Za-z0-9])/.test(value)) {
        setErrors(prev => ({ ...prev, password: 'Needs upper, lower, number, special char' }));
      } else {
        setErrors(prev => ({ ...prev, password: '' }));
      }
    } else if (name === 'confirmPassword') {
      if (value !== formData.password) {
        setErrors(prev => ({ ...prev, confirmPassword: 'Passwords do not match' }));
      } else {
        setErrors(prev => ({ ...prev, confirmPassword: '' }));
      }
    }
  };

  // Handle country code change
  const handleCountryCodeChange = (event) => {
    setFormData(prev => ({
      ...prev,
      countryCode: event.target.value
    }));
  };

  const handleClickShowPassword = () => {
    setFormData(prev => ({
      ...prev,
      showPassword: !prev.showPassword
    }));
  };
  
  const handleClickShowConfirmPassword = () => {
    setFormData(prev => ({
      ...prev,
      showConfirmPassword: !prev.showConfirmPassword
    }));
  };
  
  const handleMouseDownPassword = (e) => {
    e.preventDefault();
  };
  
  // Form submission handler
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate form and check for duplicates
    const isValid = await validateForm();
    if (!isValid) {
      toast.error('Please fix the form errors before submitting');
      return;
    }
    
    // Ensure WebSocket is connected before submitting
    if (!socketService.isConnected()) {
      socketService.connect();
    }
    
    setLoading(true);
    
    try {
      // Format phone number in E.164 format (e.g., +14155552671)
      // Remove all non-digit characters first
      const digitsOnly = formData.phoneNumber.replace(/\D/g, '');
      // Combine with country code (ensure country code has +)
      const countryCode = formData.countryCode.startsWith('+') 
        ? formData.countryCode 
        : `+${formData.countryCode.replace(/\D/g, '')}`;
      const fullPhoneNumber = `${countryCode}${digitsOnly}`;
      
      const userData = {
        username: formData.username.trim(),
        email: formData.email.trim(),
        password: formData.password,
        phoneNumber: fullPhoneNumber,
        role: formData.role
      };
      
      const response = await axios.post(`${import.meta.env.VITE_API_URL}/api/users/register`, userData);
      
      // Store the token in local storage
      localStorage.setItem('token', response.data.token);
      
      // Store user data in local storage
      localStorage.setItem('user', JSON.stringify({
        id: response.data.user.id,
        username: response.data.user.username,
        email: response.data.user.email,
        phoneNumber: response.data.user.phoneNumber,
        role: response.data.user.role
      }));
      
      // Show success message
      toast.success('Account created successfully!');
      
      // Redirect based on user role
      const redirectPath = response.data.user.role === 'admin' ? '/admin/dashboard' : '/home';
      
      // Redirect after a short delay
      setTimeout(() => {
        navigate(redirectPath);
      }, 1500);
      
    } catch (error) {
      console.error('Registration error:', error);
      let errorMessage = 'Registration failed. Please try again.';
      
      // Handle specific error messages from the backend
      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error.message === 'Network Error') {
        errorMessage = 'Unable to connect to the server. Please check your internet connection.';
      }
      
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };
  
  // Navigation handlers
  const handleBack = () => {
    setMounted(false);
    setTimeout(() => navigate(-1), 300);
  };

  // Handle admin-only access
  useEffect(() => {
    if (!isAuthenticated()) {
      navigate('/login');
    } else if (role && role !== 'admin') {
      navigate('/unauthorized');
    }
  }, [navigate, role]);

  // Don't render until we've checked authentication
  if (!isAuthenticated() || (role && role !== 'admin')) {
    return null;
  }

  return (
    <div className="create-account-container">
      <SideBar isOpen={isMenuOpen} onClose={closeMenu} username={username} role={role} />
      <div className={`main-content ${isMenuOpen ? 'menu-open' : ''}`}>
        <div className="create-account-content">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: mounted ? 1 : 0, y: mounted ? 0 : 20 }}
            transition={{ duration: 0.5 }}
            className="create-account-card"
          >
       {/*      <div className="create-account-header">
              <h2>Create New Account</h2>
            </div> */}
            <Typography variant="h4" component="h1" className="page-title">Create New Account</Typography>
            
            <form onSubmit={handleSubmit} className="create-account-form">
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Username"
                    name="username"
                    value={formData.username}
                    onChange={handleChange}
                    fullWidth
                    margin="normal"
                    error={!!errors.username}
                    helperText={errors.username}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <PersonIcon />
                        </InputAdornment>
                      ),
                    }}
                  />
                </Grid>
                
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth margin="normal" error={!!errors.role}>
                    <InputLabel>Role</InputLabel>
                    <Select
                      name="role"
                      value={formData.role}
                      onChange={handleChange}
                      label="Role"
                    >
                      <MenuItem value="user">User</MenuItem>
                      <MenuItem value="admin">Admin</MenuItem>
                    </Select>
                    {errors.role && <div className="error-text">{errors.role}</div>}
                  </FormControl>
                </Grid>
                
                <Grid item xs={12}>
                  <TextField
                    label="Email"
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={handleChange}
                    fullWidth
                    margin="normal"
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
                </Grid>
                
                <Grid item xs={12}>
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                    <FormControl variant="outlined" sx={{ width: '150px' }}>
                      <InputLabel id="country-code-label">Country</InputLabel>
                      <MuiSelect
                        labelId="country-code-label"
                        value={formData.countryCode}
                        onChange={handleCountryCodeChange}
                        label="Country"
                        sx={{
                          '& .MuiSelect-select': {
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '16.5px 14px'
                          }
                        }}
                      >
                        {countryCodes.map((country) => (
                          <MenuItem key={country.code} value={country.dialCode}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <ReactCountryFlag 
                                countryCode={country.code}
                                svg
                                style={{
                                  width: '1.5em',
                                  height: '1em',
                                  borderRadius: '2px',
                                  boxShadow: '0 0 1px rgba(0,0,0,0.5)'
                                }}
                                title={country.code}
                              />
                              <span>{country.dialCode}</span>
                            </Box>
                          </MenuItem>
                        ))}
                      </MuiSelect>
                    </FormControl>
                    <TextField
                      label="Phone Number"
                      name="phoneNumber"
                      value={formData.phoneNumber}
                      onChange={handleChange}
                      fullWidth
                      margin="normal"
                      style={{marginTop:'1px'}}
                      error={!!errors.phoneNumber}
                      helperText={errors.phoneNumber || 'Enter number without country code'}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <PhoneIcon />
                          </InputAdornment>
                        ),
                      }}
                    />
                  </Box>
                  <FormHelperText sx={{ mt: -1, ml: 1, fontSize: '0.75rem', color: 'text.secondary' }}>
                    Full number: {formData.countryCode}{formData.phoneNumber}
                  </FormHelperText>
                </Grid>
                
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Password"
                    name="password"
                    type={formData.showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={handleChange}
                    fullWidth
                    margin="normal"
                    error={!!errors.password}
                    helperText={errors.password || 'At least 6 characters with uppercase, lowercase, number & special character'}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <LockIcon />
                        </InputAdornment>
                      ),
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            onClick={handleClickShowPassword}
                            onMouseDown={handleMouseDownPassword}
                            edge="end"
                          >
                            {formData.showPassword ? <VisibilityOff /> : <Visibility />}
                          </IconButton>
                        </InputAdornment>
                      ),
                    }}
                  />
                </Grid>
                
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Confirm Password"
                    name="confirmPassword"
                    type={formData.showConfirmPassword ? 'text' : 'password'}
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    fullWidth
                    margin="normal"
                    error={!!errors.confirmPassword}
                    helperText={errors.confirmPassword}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <LockIcon />
                        </InputAdornment>
                      ),
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            onClick={handleClickShowConfirmPassword}
                            onMouseDown={handleMouseDownPassword}
                            edge="end"
                          >
                            {formData.showConfirmPassword ? <VisibilityOff /> : <Visibility />}
                          </IconButton>
                        </InputAdornment>
                      ),
                    }}
                  />
                </Grid>
              </Grid>
              
              <Button
                type="submit"
                variant="contained"
                color="primary"
                fullWidth
                size="large"
                className="create-account-button"
                disabled={loading || checkingDuplicates}
                startIcon={(loading || checkingDuplicates) ? <CircularProgress size={20} color="inherit" /> : <PersonAddIcon />}
              >
                {checkingDuplicates ? 'Checking...' : loading ? 'Creating Account...' : 'Create Account'}
              </Button>
            </form>
          </motion.div>
        </div>
      </div>
      <ToastContainer position="bottom-right" autoClose={5000} />
    </div>
  );
};

export default CreateAccount;
