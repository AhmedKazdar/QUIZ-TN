import { useRouter, useLocalSearchParams } from "expo-router";
import React, { useState, useRef, useEffect } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";

const API_URL = "http://192.168.1.115:3001";

export default function OtpVerificationScreen() {
  const router = useRouter();
  const { phoneNumber, flow } = useLocalSearchParams<{
    phoneNumber: string;
    flow: "login" | "register";
  }>();
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textInputRef = useRef<TextInput>(null);

  useEffect(() => {
    console.log("Focusing TextInput");
    textInputRef.current?.focus();
  }, []);

  const handleVerifyOtp = async () => {
    if (!otp) {
      setError("Please enter the OTP.");
      Alert.alert("Verification Failed", "Please enter the OTP.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const endpoint =
        flow === "login"
          ? "/users/login/phone/verify"
          : "/users/register/verify";
      const response = await axios.post(`${API_URL}${endpoint}`, {
        phoneNumber,
        otp,
        createUserDto:
          flow === "register" ? { phoneNumber, username: "temp" } : undefined,
      });
      await AsyncStorage.setItem("token", response.data.access_token);
      await SecureStore.setItemAsync("userId", response.data.userId);
      if (flow === "login") {
        await AsyncStorage.setItem("username", response.data.username);
        Alert.alert("Success", "Login successful!");
        router.replace("/(drawer)");
      } else {
        Alert.alert("Success", "OTP verified! Choose your username.");
        router.push({
          pathname: "/username" as const,
          params: { phoneNumber },
        });
      }
    } catch (error: any) {
      const message =
        error.response?.data?.message ||
        error.message ||
        "OTP verification failed";
      console.error("Verify OTP error:", message);
      setError(message);
      Alert.alert("Error", message);
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setLoading(true);
    setError(null);
    try {
      const endpoint =
        flow === "login" ? "/users/login/phone" : "/users/register";
      const response = await axios.post(`${API_URL}${endpoint}`, {
        phoneNumber,
      });
      console.log("Resend OTP response:", response.data);
      Alert.alert("Success", "OTP resent successfully.");
      textInputRef.current?.focus();
    } catch (error: any) {
      const message = error.response?.data?.message || "Failed to resend OTP.";
      console.error("Resend OTP error:", message);
      setError(message);
      Alert.alert("Error", message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
    >
      <View style={styles.card}>
        <Text style={styles.title}>Verify OTP</Text>
        <Text style={styles.subtitle}>Enter the OTP sent to {phoneNumber}</Text>
        {error && <Text style={styles.error}>{error}</Text>}

        <View style={styles.inputContainer}>
          <Ionicons name="key-outline" size={20} color="#555" />
          <TextInput
            ref={textInputRef}
            style={styles.input}
            placeholder="Enter OTP"
            placeholderTextColor="black"
            value={otp}
            onChangeText={(text) => {
              console.log("TextInput changed:", text);
              setOtp(text.replace(/[^0-9]/g, ""));
            }}
            keyboardType="numeric"
            maxLength={6}
            editable={!loading}
            autoFocus={true}
            returnKeyType="done"
            onSubmitEditing={handleVerifyOtp}
            onFocus={() => console.log("TextInput focused")}
            onBlur={() => console.log("TextInput blurred")}
          />
        </View>

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleVerifyOtp}
          disabled={loading}
        >
          <Text style={styles.buttonText}>
            {loading ? "Verifying..." : "Verify OTP"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleResendOtp}
          disabled={loading}
        >
          <Text style={styles.buttonText}>Resend OTP</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => router.back()}
        >
          <Text style={styles.secondaryButtonText}>
            Return to {flow === "login" ? "Login" : "Registration"}
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
  title: {
    fontSize: 24,
    textAlign: "center",
    marginBottom: 24,
    fontWeight: "600",
    color: "#333",
  },
  subtitle: {
    fontSize: 14,
    textAlign: "center",
    marginBottom: 24,
    color: "#777",
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
