import axios from "axios";

import AsyncStorage from "@react-native-async-storage/async-storage";

// Create Axios instance
const api = axios.create({
  baseURL: "http://192.168.1.100:3001",
  timeout: 5000,
});

api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem("user_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Handle common errors (e.g., 401 Unauthorized)
    if (error.response?.status === 401) {
      // Optionally clear token and redirect to login
      AsyncStorage.removeItem("user_token");
    }
    return Promise.reject(error);
  }
);

/* // API methods
export const register = async (userData) => {
  const response = await api.post("/users/register", userData);
  return response.data;
};

export const verifyOtp = async (data) => {
  const response = await api.post("/users/register/verify", data);
  return response.data;
};

export const login = async (credentials) => {
  const response = await api.post("/users/login", credentials);
  // Store token if returned
  if (response.data.token) {
    await AsyncStorage.setItem("user_token", response.data.token);
  }
  return response.data;
};
 */
export default api;
