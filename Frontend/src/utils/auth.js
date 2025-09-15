// src/utils/auth.js
export const isAuthenticated = () => {
  const token = localStorage.getItem("token");
  const isAuth = localStorage.getItem("isAuthenticated");
  return token && isAuth === "true";
};

export const getCurrentUser = () => {
  if (!isAuthenticated()) {
    return null;
  }
  
  try {
    const userData = localStorage.getItem("userData");
    if (!userData) {
      // Try to get user data from token if not in localStorage
      const token = localStorage.getItem("token");
      if (!token) return null;
      
      // Decode the token to get user info
      const base64Url = token.split('.')[1];
      if (!base64Url) return null;
      
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      
      const user = JSON.parse(jsonPayload);
      // Cache the user data in localStorage for future use
      localStorage.setItem("userData", JSON.stringify(user));
      return user;
    }
    
    return JSON.parse(userData);
  } catch (error) {
    console.error("Error getting current user:", error);
    return null;
  }
};

// Clear all auth data
export const clearAuthData = () => {
  localStorage.removeItem("token");
  localStorage.removeItem("isAuthenticated");
  localStorage.removeItem("userData");
};
