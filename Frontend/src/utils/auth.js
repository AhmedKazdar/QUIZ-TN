// src/utils/auth.js
export const isAuthenticated = () => {
  const token = localStorage.getItem("token");
  const isAuth = localStorage.getItem("isAuthenticated");
  return token && isAuth === "true";
};
