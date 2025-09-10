import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { jwtDecode } from 'jwt-decode';

const AdminRoute = ({ children }) => {
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const token = localStorage.getItem('token');
  
  useEffect(() => {
    const checkAdminStatus = () => {
      if (!token) {
        console.log('AdminRoute - No token found');
        setIsAdmin(false);
        setIsLoading(false);
        return;
      }

      try {
        const decoded = jwtDecode(token);
        console.log('AdminRoute - Decoded token:', decoded);
        const userIsAdmin = decoded.role === 'admin';
        console.log('AdminRoute - User is admin:', userIsAdmin);
        setIsAdmin(userIsAdmin);
      } catch (error) {
        console.error('AdminRoute - Error decoding token:', error);
        setIsAdmin(false);
      } finally {
        setIsLoading(false);
      }
    };

    checkAdminStatus();
  }, [token]);

  if (isLoading) {
    return <div>Loading...</div>; // Or a loading spinner
  }

  if (!token) {
    console.log('AdminRoute - No token, redirecting to login');
    return <Navigate to="/login" replace />;
  }

  if (!isAdmin) {
    console.log('AdminRoute - Not an admin, redirecting to home');
    return <Navigate to="/home" replace />;
  }

  console.log('AdminRoute - Access granted to admin');
  return children;
};

export default AdminRoute;
