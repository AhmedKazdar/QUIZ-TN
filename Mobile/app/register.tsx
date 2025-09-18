import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState, useEffect } from "react";
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
  ActivityIndicator,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { parsePhoneNumberWithError } from "libphonenumber-js";

const API_URL = "http://192.168.1.153:3001";

interface RegisterForm {
  username: string;
  phoneNumber: string;
}

export default function RegisterScreen() {
  const router = useRouter();
  const [formData, setFormData] = useState<RegisterForm>({
    username: "",
    phoneNumber: "+216"
  });
  const [loading, setLoading] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Check if user is already logged in
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const token = await AsyncStorage.getItem('token');
        const username = await AsyncStorage.getItem('username');
        
        if (token && username) {
          // User is already logged in, redirect to home
          router.replace('/(drawer)');
          return;
        }
      } catch (error) {
        console.error('Error checking auth status:', error);
      } finally {
        setCheckingAuth(false);
      }
    };

    checkAuth();
  }, []);

  if (checkingAuth) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  const handleInputChange = (field: keyof RegisterForm, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (error) setError(null);
  };

  const handleRegister = async () => {
    try {
      // Basic validation
      if (!formData.username.trim()) {
        setError("Username is required");
        return;
      }

      if (formData.username.length < 3 || formData.username.length > 20) {
        setError("Username must be between 3-20 characters");
        return;
      }

      // Validate phone number
      const phone = parsePhoneNumberWithError(formData.phoneNumber, "TN");
      if (!phone.isValid()) {
        throw new Error("Please enter a valid Tunisian phone number (+216 followed by 8 digits).");
      }

      setLoading(true);
      setError(null);

      // Send registration request to backend Player API
      await axios.post(`${API_URL}/api/player/register`, {
        username: formData.username,
        phoneNumber: phone.number,
      });

      // Store temp data for verification
      await AsyncStorage.setItem("registerData", JSON.stringify({
        username: formData.username,
        phoneNumber: phone.number
      }));

      // Navigate to OTP verification
      router.push({
        pathname: "/otp-verification",
        params: {
          phoneNumber: phone.number,
          flow: "register",
        },
      });

    } catch (error: any) {
      const message = error.response?.data?.message || 
                     error.message || 
                     "Failed to register. Please try again.";
      console.log("Register error details:", {
        message,
        code: error?.code,
        url: `${API_URL}/player/register`,
        hasResponse: !!error?.response,
        status: error?.response?.status,
        data: error?.response?.data,
      });
      setError(message);
      Alert.alert("Registration Failed", message);
    } finally {
      setLoading(false);
    }
  };

  // Quick connectivity test to backend /health endpoint
  const testConnectivity = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/health`, { timeout: 5000 });
      Alert.alert("Backend Health", JSON.stringify(res.data));
    } catch (error: any) {
      console.log("Health check failed:", {
        message: error?.message,
        code: error?.code,
        url: `${API_URL}/api/health`,
        hasResponse: !!error?.response,
        status: error?.response?.status,
        data: error?.response?.data,
      });
      Alert.alert("Health check failed", error?.message || "Network error");
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
        <Text style={styles.title}>Create Account</Text>
        {error && <Text style={styles.error}>{error}</Text>}

        <View style={styles.inputContainer}>
          <Ionicons name="person-outline" size={20} color="#555" />
          <TextInput
            style={styles.input}
            placeholder="Choose a username"
            placeholderTextColor="#999"
            value={formData.username}
            onChangeText={(text) => handleInputChange("username", text)}
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={20}
          />
        </View>

        <View style={styles.inputContainer}>
          <Ionicons name="call-outline" size={20} color="#555" />
          <TextInput
            style={styles.input}
            placeholder="Phone Number (e.g., +21612345678)"
            placeholderTextColor="#999"
            value={formData.phoneNumber}
            onChangeText={(text) => handleInputChange("phoneNumber", text)}
            keyboardType="phone-pad"
            autoCapitalize="none"
          />
        </View>

        <TouchableOpacity
          style={[styles.button, (loading || !formData.username || !formData.phoneNumber) && styles.buttonDisabled]}
          onPress={handleRegister}
          disabled={loading || !formData.username || !formData.phoneNumber}
        >
          <Text style={styles.buttonText}>
            {loading ? "Sending OTP..." : "Send OTP"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, { marginTop: 12 }]}
          onPress={testConnectivity}
          disabled={loading}
        >
          <Text style={styles.buttonText}>Test Connection</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
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
    fontSize: 16,
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
  registerContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 30,
  },
  footerText: {
    color: "#777",
    fontSize: 14,
    marginRight: 5,
  },
  registerLink: {
    color: "#3B82F6",
    fontWeight: "600",
  },
});
