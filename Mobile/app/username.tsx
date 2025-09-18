import { useRouter, useLocalSearchParams } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import axios from "axios";

const API_URL = "http://192.168.1.153:3001";

export default function UsernameScreen() {
  const router = useRouter();
  const { phoneNumber } = useLocalSearchParams<{ phoneNumber: string }>();
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateRandomUsername = () => {
    const adjectives = ["Cool", "Quiz", "Smart", "Fun", "Swift"];
    const nouns = ["Player", "Star", "Wizard", "Guru", "Champ"];
    const randomAdj = adjectives[Math.floor(Math.random() * adjectives.length)];
    const randomNoun = nouns[Math.floor(Math.random() * nouns.length)];
    const randomNum = Math.floor(Math.random() * 1000);
    return `${randomAdj}${randomNoun}${randomNum}`;
  };

  const handleRandomUsername = () => {
    setUsername(generateRandomUsername());
  };

  const handleSubmit = async () => {
    if (!username.trim()) {
      setError("Please enter or generate a username.");
      Alert.alert("Error", "Please enter or generate a username.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const token = await AsyncStorage.getItem("token");
      const userId = await SecureStore.getItemAsync("userId");
      if (!token || !userId) {
        throw new Error("User not authenticated");
      }
      await axios.put(
        `${API_URL}/users/update/${userId}`,
        { username, phoneNumber },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      await AsyncStorage.setItem("username", username);
      Alert.alert("Success", "Registration completed!");
      router.replace("/(drawer)");
    } catch (error: any) {
      const message =
        error.response?.data?.message || "Failed to update username.";
      console.error("Username update error:", message);
      setError(message);
      Alert.alert("Error", message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.select({ ios: "padding", android: undefined })}
    >
      <View style={styles.card}>
        <Image
          source={require("@/assets/onboarding1.png")}
          style={styles.logo}
        />
        <Text style={styles.title}>Choose Your Username</Text>
        {error && <Text style={styles.error}>{error}</Text>}

        <View style={styles.inputContainer}>
          <Ionicons name="person-outline" size={20} color="#555" />
          <TextInput
            style={styles.input}
            placeholder="Enter username or generate one"
            placeholderTextColor="black"
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
          />
        </View>

        <TouchableOpacity style={styles.button} onPress={handleRandomUsername}>
          <Text style={styles.buttonText}>Generate Random Username</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleSubmit}
          disabled={loading}
        >
          <Text style={styles.buttonText}>
            {loading ? "Saving..." : "Complete Registration"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => router.back()}
        >
          <Text style={styles.secondaryButtonText}>
            Back to OTP Verification
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    justifyContent: "center",
    padding: 24,
  },
  card: {
    backgroundColor: "#fff",
    padding: 24,
    borderRadius: 16,
    elevation: 6,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
  },
  logo: {
    width: 100,
    height: 100,
    alignSelf: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    textAlign: "center",
    marginBottom: 24,
    fontWeight: "600",
    color: "#333",
  },
  error: {
    color: "red",
    textAlign: "center",
    marginBottom: 15,
    fontSize: 14,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderColor: "#ccc",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 15,
    backgroundColor: "#f9f9f9",
  },
  input: {
    flex: 1,
    marginLeft: 10,
    color: "#000",
  },
  button: {
    backgroundColor: "#3B82F6",
    paddingVertical: 14,
    borderRadius: 10,
    marginTop: 8,
  },
  buttonDisabled: {
    backgroundColor: "#a0c4ff",
  },
  buttonText: {
    textAlign: "center",
    color: "#fff",
    fontWeight: "600",
    fontSize: 16,
  },
  secondaryButton: {
    backgroundColor: "#EF4444",
    paddingVertical: 14,
    borderRadius: 10,
    marginTop: 8,
  },
  secondaryButtonText: {
    textAlign: "center",
    color: "#fff",
    fontWeight: "600",
    fontSize: 16,
  },
});
