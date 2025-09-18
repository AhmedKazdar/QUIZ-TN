import { useRouter, useLocalSearchParams } from "expo-router";
import React, { useState, useEffect, useRef } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";

const API_URL = "http://192.168.1.153:3001";

interface RegisterData {
  username: string;
  phoneNumber: string;
}

export default function OtpVerificationScreen() {
  const router = useRouter();
  const { phoneNumber, flow } = useLocalSearchParams<{
    phoneNumber: string;
    flow: "login" | "register";
  }>();
  
  const [otp, setOtp] = useState(["", "", "", ""]);
  const [loading, setLoading] = useState(true);
  const [resendLoading, setResendLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [registerData, setRegisterData] = useState<RegisterData | null>(null);
  const [countdown, setCountdown] = useState(60);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const inputRefs = [
    useRef<TextInput>(null),
    useRef<TextInput>(null),
    useRef<TextInput>(null),
    useRef<TextInput>(null),
  ];

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
        
        // Load registration data if it's a registration flow
        if (flow === "register") {
          const data = await AsyncStorage.getItem("registerData");
          if (data) {
            setRegisterData(JSON.parse(data));
          }
        }
        
        // Auto-focus the first input
        inputRefs[0].current?.focus();
      } catch (error) {
        console.error('Error checking auth status:', error);
      } finally {
        setCheckingAuth(false);
        setLoading(false);
      }
    };

    checkAuth();
    
    // Countdown timer for resend OTP
    const timer = setInterval(() => {
      setCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    
    return () => clearInterval(timer);
  }, [flow]);

  if (checkingAuth) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  const handleOtpChange = (text: string, index: number) => {
    if (error) setError(null);
    
    // Only allow numbers
    const numericValue = text.replace(/[^0-9]/g, '');
    
    // Update the OTP array
    const newOtp = [...otp];
    newOtp[index] = numericValue.slice(-1); // Only take the last character
    setOtp(newOtp);
    
    // Auto-focus next input or submit if last input
    if (numericValue && index < 3) {
      inputRefs[index + 1]?.current?.focus();
    } else if (index === 3 && numericValue) {
      // If last input, blur the keyboard
      inputRefs[index]?.current?.blur();
    }
  };

  const handleKeyPress = (e: { nativeEvent: { key: string } }, index: number) => {
    // Handle backspace
    if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs[index - 1].current?.focus();
    }
  };

  const handleVerifyOtp = async () => {
    const otpCode = otp.join('');
    
    if (otpCode.length !== 4) {
      setError("Please enter a valid 4-digit OTP");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let response;
      
      if (flow === "register" && registerData) {
        // Verify OTP for registration against Player API
        response = await axios.post(`${API_URL}/api/player/verify-otp`, {
          phoneNumber: registerData.phoneNumber,
          otp: otpCode,
          username: registerData.username,
        });

        // Store user data from response
        await AsyncStorage.setItem("token", response.data.token);
        await AsyncStorage.setItem("username", response.data.player?.username || registerData.username);
        await AsyncStorage.setItem("userRole", "user");
        await AsyncStorage.removeItem("registerData");
        
      } else if (flow === "login") {
        // For now reuse the same endpoint assuming phone login flow
        response = await axios.post(`${API_URL}/api/player/verify-otp`, {
          phoneNumber,
          otp: otpCode,
        });

        // Store user data
        await AsyncStorage.setItem("token", response.data.token);
        await AsyncStorage.setItem("username", response.data.player?.username || "");
        await AsyncStorage.setItem("userRole", "user");
      }
      
      // Navigate to home screen after successful verification
      router.replace("/(drawer)");
    } catch (error: any) {
      const message = 
        error.response?.data?.message || 
        error.message || 
        "Failed to verify OTP. Please try again.";
      console.error("OTP verification error:", message);
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (countdown > 0) return;
    
    setResendLoading(true);
    setError(null);
    
    try {
      const phone = flow === "register" ? registerData?.phoneNumber : phoneNumber;
      
      if (!phone) {
        throw new Error("Phone number is required");
      }
      
      // Reuse Player register endpoint to resend OTP
      await axios.post(`${API_URL}/api/player/register`, {
        phoneNumber: phone,
      });
      
      // Reset countdown
      setCountdown(60);
      Alert.alert("Success", "OTP has been resent to your phone number.");
    } catch (error: any) {
      const message = 
        error.response?.data?.message || 
        error.message || 
        "Failed to resend OTP. Please try again.";
      setError(message);
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={styles.card}>
        <View style={styles.header}>
          <Text style={styles.title}>Verify Your Phone</Text>
          <Text style={styles.subtitle}>
            We've sent a verification code to {flow === "register" ? registerData?.phoneNumber : phoneNumber}
          </Text>
        </View>

        {error && <Text style={styles.error}>{error}</Text>}

        <View style={styles.otpContainer}>
          {otp.map((digit, index) => (
            <TextInput
              key={index}
              ref={inputRefs[index]}
              style={[styles.otpInput, error ? styles.errorInput : null]}
              value={digit}
              onChangeText={(text) => handleOtpChange(text, index)}
              onKeyPress={(e) => handleKeyPress(e, index)}
              keyboardType="number-pad"
              maxLength={1}
              selectTextOnFocus
              editable={!loading}
            />
          ))}
        </View>

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleVerifyOtp}
          disabled={loading || otp.join('').length !== 4}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Verify OTP</Text>
          )}
        </TouchableOpacity>

        <View style={styles.resendContainer}>
          <Text style={styles.resendText}>
            Didn't receive the code? 
          </Text>
          <TouchableOpacity 
            onPress={handleResendOtp} 
            disabled={countdown > 0 || resendLoading}
          >
            <Text 
              style={[
                styles.resendLink, 
                (countdown > 0 || resendLoading) && styles.resendLinkDisabled
              ]}
            >
              {resendLoading 
                ? 'Sending...' 
                : countdown > 0 
                  ? `Resend in ${countdown}s` 
                  : 'Resend Code'}
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
          disabled={loading}
        >
          <Ionicons name="arrow-back" size={20} color="#3B82F6" />
          <Text style={styles.backButtonText}>
            Back to {flow === 'register' ? 'Register' : 'Login'}
          </Text>
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
  header: {
    marginBottom: 32,
    alignItems: "center",
  },
  title: {
    fontSize: 24,
    fontWeight: "600",
    color: "#333",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
    marginTop: 8,
  },
  error: {
    color: "red",
    textAlign: "center",
    marginBottom: 16,
    fontSize: 14,
  },
  otpContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 32,
  },
  otpInput: {
    width: 60,
    height: 60,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    textAlign: "center",
    fontSize: 24,
    fontWeight: "600",
    color: "#333",
    backgroundColor: "#f9f9f9",
  },
  errorInput: {
    borderColor: "red",
  },
  button: {
    backgroundColor: "#3B82F6",
    paddingVertical: 16,
    borderRadius: 10,
    marginBottom: 24,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 56,
  },
  buttonDisabled: {
    backgroundColor: "#a0c4ff",
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
  },
  resendContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
    flexWrap: 'wrap',
  },
  resendText: {
    color: "#666",
    fontSize: 14,
    textAlign: 'center',
  },
  resendLink: {
    color: "#3B82F6",
    fontWeight: "600",
    fontSize: 14,
  },
  resendLinkDisabled: {
    color: "#a0c4ff",
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 10,
    marginTop: 16,
    opacity: 0.8,
  },
  backButtonText: {
    color: "#3B82F6",
    fontWeight: "600",
    marginLeft: 8,
    fontSize: 14,
  },
});
