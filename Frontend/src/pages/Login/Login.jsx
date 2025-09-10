import React, { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import axios from "axios";
import { toast, ToastContainer } from "react-toastify";
import PersonIcon from '@mui/icons-material/Person';
import LockIcon from '@mui/icons-material/Lock';
import LoginIcon from '@mui/icons-material/Login';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import "react-toastify/dist/ReactToastify.css";
import "./Login.css";
import socketService from "../../services/socketService";
import { isAuthenticated } from "../../utils/auth";

const LoginForm = () => {
  const [formData, setFormData] = useState({
    username: "",
    password: ""
  });
    const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [shake, setShake] = useState(false);
  const [isFormValid, setIsFormValid] = useState(false);
  const errorTimeoutRef = useRef(null);
  const navigate = useNavigate();

  // Clean up timeouts on unmount
  useEffect(() => {
    return () => {
      if (errorTimeoutRef.current) {
        clearTimeout(errorTimeoutRef.current);
      }
    };
  }, []);

  // Redirect if authenticated
  useEffect(() => {
    if (isAuthenticated()) {
      navigate("/home", { replace: true });
    }
  }, [navigate]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const validateForm = () => {
    return formData.username.trim() !== '' && formData.password.trim() !== '';
  };

  useEffect(() => {
    setIsFormValid(validateForm());
  }, [formData]);

  const showError = (message) => {
    // Clear any existing timeout
    if (errorTimeoutRef.current) {
      clearTimeout(errorTimeoutRef.current);
    }
    
    // Set error and start fade out after delay
    setError(message);
    
    // Start fade out animation 4.5 seconds before hiding
    errorTimeoutRef.current = setTimeout(() => {
      const errorElement = document.querySelector('.error-text');
      if (errorElement) {
        errorElement.classList.add('fade-out');
      }
      
      // Remove from DOM after animation completes
      setTimeout(() => {
        setError("");
      }, 300);
    }, 4500);
  };

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 500);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      showError("Please fill in all fields");
      triggerShake();
      return;
    }
    
    setLoading(true);
    setError("");

    try {
      const response = await axios.post("http://localhost:3001/users/login", {
        username: formData.username,
        password: formData.password,
      });

      const { access_token, userId, role, username: responseUsername } = response.data;

      // Store user data
      localStorage.setItem("token", access_token);
      localStorage.setItem("userId", userId);
      localStorage.setItem("role", role);
      localStorage.setItem("username", responseUsername || formData.username);
      localStorage.setItem("isAuthenticated", "true");

      // Connect socket
      try {
        socketService.connect();
      } catch (socketError) {
        console.error("Socket connection error:", socketError);
      }

      setLoading(false);
      
      // Show success message
      toast.success("🎉 Login successful! Redirecting...");

      // Redirect after a short delay
      setTimeout(() => {
        navigate("/home", { replace: true });
      }, 1500);
      
    } catch (err) {
      console.error("Login error:", err.response?.data || err.message);
      const errorMessage = err.response?.data?.message || "Invalid username or password";
      showError(errorMessage);
      toast.error(`❌ ${errorMessage}`);
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-container">
        
        <div className={`auth-card ${shake ? 'shake' : ''}`}>
          <div className="auth-header">
            <LoginIcon className="auth-icon" />
            <h1>Welcome Back</h1>
            <p>Sign in to continue to your account</p>
          </div>
          
          <form onSubmit={handleLogin} className="auth-form">
            <div className="form-group">
              <div className="input-group">
                <PersonIcon className="input-icon" />
                <input
                  type="text"
                  id="username"
                  name="username"
                  value={formData.username}
                  onChange={handleChange}
                  className={`form-input ${error ? 'error' : ''}`}
                  placeholder=" "
                  required
                  autoComplete="username"
                />
                <label htmlFor="username" className="input-label">Username</label>
              </div>
            </div>

            <div className="form-group">
              <div className="input-group">
                <LockIcon className="input-icon" />
                <input
                  type={showPassword ? "text" : "password"}
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  className={`form-input ${error ? 'error' : ''}`}
                  placeholder=" "
                  required
                  autoComplete="current-password"
                />
                <label htmlFor="password" className="input-label">Password</label>
                <button 
                  type="button" 
                  className="password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <VisibilityOff /> : <Visibility />}
                </button>
              </div>
            </div>

            {error && <span className="error-message">{error}</span>}

            <button 
              type="submit" 
              className="login-submit-button"
              disabled={loading || !isFormValid}
              style={{
                '--primary-color': '#4361ee',
                '--secondary-color': '#3f37c9',
              }}
            >
              <span className="button-content">
                {loading ? (
                  <span className="button-loader"></span>
                ) : (
                  <>
                    <LoginIcon className="button-icon" />
                    Sign In
                  </>
                )}
              </span>
            </button>

           
          </form>
        </div>
      </div>

      <ToastContainer
        position="top-center"
        autoClose={3000}
        hideProgressBar={true}
        newestOnTop={true}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="light"
        style={{ marginTop: '20px' }}
      />
      
      <div className="login-decoration">
        <div className="shape shape-1"></div>
        <div className="shape shape-2"></div>
        <div className="shape shape-3"></div>
      </div>
    </div>
  );
};

export default LoginForm;
