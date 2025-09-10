import { Navigate } from "react-router-dom";

const PrivateRoute = ({ children }) => {
  // Check if the user is authenticated (based on localStorage flag)
  const isAuthenticated = localStorage.getItem("isAuthenticated");

  // If the user is authenticated, render the children (protected content)
  // If not, redirect to the login page
  return isAuthenticated === "true" ? children : <Navigate to="/login" />;
};

export default PrivateRoute;
