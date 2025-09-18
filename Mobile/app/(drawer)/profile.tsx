import React, { useEffect, useState } from "react";
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import axios from "axios";
import { router } from "expo-router";

const API_URL = "http://192.168.1.153:3001";

export default function ProfileScreen() {
  const [user, setUser] = useState<{
    username: string;
    phoneNumber: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const token = await AsyncStorage.getItem("token");
        const userId = await SecureStore.getItemAsync("userId");

        if (!token || !userId) {
          setError("Not authenticated. Please log in.");
          setLoading(false);
          return;
        }

        console.log("fetchUserData - userId:", userId, "token:", token);

        // Fetch all users and filter for the current user
        const response = await axios.get(`${API_URL}/users`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        console.log("fetchUserData - Response from /users:", response.data);

        const currentUser = response.data.users.find(
          (u: any) => u._id === userId
        );

        if (!currentUser) {
          throw new Error("User not found in response");
        }

        setUser({
          username: currentUser.username,
          phoneNumber: currentUser.phoneNumber,
        });
        setError(null);
        console.log("fetchUserData - Current user:", currentUser);
      } catch (err: any) {
        const status = err.response?.status;
        const errorMessage =
          err.response?.data?.message ||
          err.message ||
          "Failed to fetch user data. Ensure backend has a valid user endpoint.";
        setError(`Error ${status || "Unknown"}: ${errorMessage}`);
        console.error("fetchUserData - Error:", {
          status,
          data: err.response?.data,
          message: err.message,
        });
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, []);

  const handleLoginRedirect = () => {
    router.replace("/login");
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Text>Loading...</Text>
      </View>
    );
  }

  if (error && !user) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.button} onPress={handleLoginRedirect}>
          <Text style={styles.buttonText}>Go to Login</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={[styles.container, { backgroundColor: "#fff" }]}
    >
      <View style={styles.profileCard}>
        <Image source={require("@/assets/avatar.png")} style={styles.avatar} />

        <Text style={styles.label}>Username</Text>
        <Text style={styles.readOnlyText}>{user?.username || "N/A"}</Text>

        <Text style={styles.label}>Phone Number</Text>
        <Text style={styles.readOnlyText}>{user?.phoneNumber || "N/A"}</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    alignItems: "center",
    justifyContent: "center",
    flexGrow: 1,
  },
  profileCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 24,
    width: "100%",
    maxWidth: 400,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 4,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignSelf: "center",
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: "500",
    marginTop: 10,
    color: "#333",
  },
  readOnlyText: {
    fontSize: 16,
    paddingVertical: 8,
    color: "#666",
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  errorText: {
    color: "#ff4d4f",
    fontSize: 14,
    marginTop: 10,
    textAlign: "center",
  },
  button: {
    marginTop: 20,
    backgroundColor: "#4e8cff",
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
