import React, { useEffect, useState } from "react";
import { useTheme } from "@react-navigation/native";
import { useRouter } from "expo-router";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Dimensions,
  Modal,
  Image,
  ImageSourcePropType,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  Easing,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import {
  useFonts,
  Poppins_600SemiBold,
  Poppins_400Regular,
} from "@expo-google-fonts/poppins";
import Svg, {
  LinearGradient as SvgLinearGradient,
  Rect,
  Defs,
  Stop,
} from "react-native-svg";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { jwtDecode } from "jwt-decode";
import {
  initializeSocket,
  disconnectSocket,
  onOnlineUsers,
} from "../../services/sockets";

const API_URL = "http://192.168.1.153:3001";
const { width, height } = Dimensions.get("window");

export default function HomeScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const [username, setUsername] = useState<string | null>(null);
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAlertModal, setShowAlertModal] = useState(false);
  const [currentSponsorImage, setCurrentSponsorImage] =
    useState<ImageSourcePropType | null>(null);
  const [fontsLoaded] = useFonts({
    Poppins_600SemiBold,
    Poppins_400Regular,
  });

  const titleOpacity = useSharedValue(0);
  const titleTranslateY = useSharedValue(20);
  const buttonScaleOnline = useSharedValue(1);
  const buttonScalePractice = useSharedValue(1);
  const modalOpacity = useSharedValue(0);
  const modalTranslateY = useSharedValue(50);

  // Sponsor images array
  const sponsorImages: ImageSourcePropType[] = [
    require("../../assets/sponsor/sponsor1.png"),
    require("../../assets/sponsor/sponsor2.png"),
    //
  ];

  // Sponsor image rotation
  useEffect(() => {
    if (loading || error || showAlertModal) return;

    const selectRandomImage = () => {
      const randomIndex = Math.floor(Math.random() * sponsorImages.length);
      setCurrentSponsorImage(sponsorImages[randomIndex]);
    };

    selectRandomImage(); // Set initial image

    const interval = setInterval(() => {
      selectRandomImage();
    }, 5000); // Change every 5 seconds

    return () => clearInterval(interval);
  }, [loading, error, showAlertModal]);

  useEffect(() => {
    titleOpacity.value = withTiming(1, {
      duration: 1000,
      easing: Easing.out(Easing.exp),
    });
    titleTranslateY.value = withSpring(0, { damping: 15, stiffness: 100 });

    const pulseOnline = () => {
      buttonScaleOnline.value = withTiming(1.05, { duration: 800 }, () => {
        buttonScaleOnline.value = withTiming(1, { duration: 800 }, pulseOnline);
      });
    };
    pulseOnline();

    const pulsePractice = () => {
      buttonScalePractice.value = withTiming(1.05, { duration: 800 }, () => {
        buttonScalePractice.value = withTiming(
          1,
          { duration: 800 },
          pulsePractice
        );
      });
    };
    pulsePractice();

    const setup = async () => {
      const token = await AsyncStorage.getItem("token");
      const storedUsername = await AsyncStorage.getItem("username");

      if (!token) {
        setError("No authentication token found.");
        setLoading(false);
        router.replace("/register");
        return;
      }

      try {
        const decodedToken = jwtDecode<{ exp: number }>(token);
        const currentTime = Date.now() / 1000;

        if (decodedToken.exp < currentTime) {
          setError("Session expired, please log in again.");
          setLoading(false);
          router.replace("/register");
          return;
        }

        setUsername(storedUsername);

        try {
          const res = await axios.get(`${API_URL}/users/online`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          console.log("Fetched online users:", res.data);
          const onlineList = res.data.onlineUsers;
          if (Array.isArray(onlineList)) {
            setOnlineUsers(onlineList);
            setError(null);
          } else {
            console.warn("Expected array for onlineUsers, got:", onlineList);
            setOnlineUsers([]);
            setError("Invalid online users data.");
          }
        } catch (err) {
          console.error("Fetch error:", err);
          setError("Unable to fetch online users.");
          setOnlineUsers([]);
        }

        const socket = await initializeSocket();
        if (socket) {
          onOnlineUsers((users: string[]) => {
            console.log("Socket online users:", users);
            setOnlineUsers(users);
            setError(null);
          });
        }
      } catch (err) {
        console.error("Token decode error:", err);
        setError("Invalid token.");
        setOnlineUsers([]);
        router.replace("/register");
      }

      setLoading(false);
    };

    setup();

    return () => {
      disconnectSocket();
      setCurrentSponsorImage(null);
    };
  }, [router]);

  useEffect(() => {
    if (showAlertModal) {
      modalOpacity.value = withTiming(1, { duration: 300 });
      modalTranslateY.value = withSpring(0, { damping: 15, stiffness: 100 });
    } else {
      modalOpacity.value = withTiming(0, { duration: 300 });
      modalTranslateY.value = withTiming(50, { duration: 300 });
    }
  }, [showAlertModal]);

  const animatedTitleStyle = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
    transform: [{ translateY: titleTranslateY.value }],
  }));

  const animatedButtonStyleOnline = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScaleOnline.value }],
  }));

  const animatedButtonStylePractice = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScalePractice.value }],
  }));

  const animatedModalStyle = useAnimatedStyle(() => ({
    opacity: modalOpacity.value,
    transform: [{ translateY: modalTranslateY.value }],
  }));

  const isOnlineModeAvailable = () => {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    return (
      (hours === 13 && minutes >= 0 && minutes <= 1) ||
      (hours === 20 && minutes >= 0 && minutes <= 1)
    );
  };

  const handleOnlineMode = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (isOnlineModeAvailable()) {
      router.push("/quiz?mode=online");
    } else {
      setShowAlertModal(true);
    }
  };

  const handlePracticeMode = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push("/quiz?mode=practice");
  };

  if (!fontsLoaded || loading) {
    return (
      <View style={styles.container}>
        <Text>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Svg height={height} width={width} style={StyleSheet.absoluteFill}>
        <Defs>
          <SvgLinearGradient
            id="bgGradient"
            x1="0%"
            y1="0%"
            x2="100%"
            y2="100%"
          >
            <Stop offset="0%" stopColor="#6B46C1" />
            <Stop offset="100%" stopColor="#4299E1" />
          </SvgLinearGradient>
        </Defs>
        <Rect
          x="0"
          y="0"
          width={width}
          height={height}
          fill="url(#bgGradient)"
        />
      </Svg>

      <View style={styles.content}>
        <View style={styles.overlay}>
          <Animated.View style={[styles.titleContainer, animatedTitleStyle]}>
            <Text style={[styles.title, { color: "#fff" }]}>
              🎉 Welcome, {username || "Guest"}! 🧠
            </Text>
            <Text style={styles.subtitle}>Test Your Wits!</Text>
          </Animated.View>

          <View style={styles.onlineUsersContainer}>
            <Text style={styles.sectionTitle}>🟢 Online Players</Text>
            {error ? (
              <Text style={styles.noUsersText}>{error}</Text>
            ) : (
              <Text style={styles.usersCountText}>
                {onlineUsers.length}{" "}
                {onlineUsers.length === 1 ? "Player" : "Players"} Online
              </Text>
            )}
            <View style={styles.modeButtonsContainer}>
              <Animated.View
                style={[styles.modeButtonWrapper, animatedButtonStyleOnline]}
              >
                <TouchableOpacity
                  style={styles.modeButton}
                  onPress={handleOnlineMode}
                >
                  <Svg height={50} width={150}>
                    <Defs>
                      <SvgLinearGradient
                        id="buttonGradient"
                        x1="0%"
                        y1="0%"
                        x2="100%"
                        y2="100%"
                      >
                        <Stop offset="0%" stopColor="#F6E05E" />
                        <Stop offset="100%" stopColor="#ECC94B" />
                      </SvgLinearGradient>
                    </Defs>
                    <Rect
                      x="0"
                      y="0"
                      width={150}
                      height={50}
                      rx={10}
                      fill="url(#buttonGradient)"
                    />
                  </Svg>
                  <Text style={styles.buttonText}>Online Mode 🌐</Text>
                </TouchableOpacity>
              </Animated.View>
              <Animated.View
                style={[styles.modeButtonWrapper, animatedButtonStylePractice]}
              >
                <TouchableOpacity
                  style={styles.modeButton}
                  onPress={handlePracticeMode}
                >
                  <Svg height={50} width={150}>
                    <Defs>
                      <SvgLinearGradient
                        id="buttonGradient"
                        x1="0%"
                        y1="0%"
                        x2="100%"
                        y2="100%"
                      >
                        <Stop offset="0%" stopColor="#F6E05E" />
                        <Stop offset="100%" stopColor="#ECC94B" />
                      </SvgLinearGradient>
                    </Defs>
                    <Rect
                      x="0"
                      y="0"
                      width={150}
                      height={50}
                      rx={10}
                      fill="url(#buttonGradient)"
                    />
                  </Svg>
                  <Text style={styles.buttonText}>Practice Mode 📚</Text>
                </TouchableOpacity>
              </Animated.View>
            </View>
          </View>
        </View>
      </View>

      {currentSponsorImage && (
        <View style={styles.sponsorContainer}>
          <Image
            source={currentSponsorImage}
            style={styles.sponsorImage}
            resizeMode="contain"
          />
        </View>
      )}

      <Modal
        transparent
        visible={showAlertModal}
        animationType="none"
        onRequestClose={() => setShowAlertModal(false)}
      >
        <View style={styles.modalOverlay}>
          <Animated.View style={[styles.alertModal, animatedModalStyle]}>
            <Svg height={200} width={300} style={StyleSheet.absoluteFill}>
              <Defs>
                <SvgLinearGradient
                  id="modalGradient"
                  x1="0%"
                  y1="0%"
                  x2="100%"
                  y2="100%"
                >
                  <Stop offset="0%" stopColor="#FF6B6B" />
                  <Stop offset="100%" stopColor="#FF8E53" />
                </SvgLinearGradient>
              </Defs>
              <Rect
                x="0"
                y="0"
                width={300}
                height={200}
                rx={16}
                fill="url(#modalGradient)"
              />
            </Svg>
            <Text style={styles.alertTitle}>Online Mode Unavailable</Text>
            <Text style={styles.alertMessage}>
              Online Mode is only available at 13:00 and 20:00. Try Practice
              Mode or check back later!
            </Text>
            <TouchableOpacity
              style={styles.alertButton}
              onPress={() => setShowAlertModal(false)}
            >
              <Text style={styles.alertButtonText}>Got It!</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.3)",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 24,
  },
  titleContainer: {
    marginTop: height * 0.1,
    alignItems: "center",
  },
  title: {
    fontSize: 36,
    fontFamily: "Poppins_600SemiBold",
    textAlign: "center",
    textShadowColor: "rgba(0, 0, 0, 0.4)",
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 6,
  },
  subtitle: {
    fontSize: 20,
    fontFamily: "Poppins_400Regular",
    color: "#E2E8F0",
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 22,
    fontFamily: "Poppins_600SemiBold",
    color: "#fff",
    marginBottom: 12,
  },
  onlineUsersContainer: {
    flex: 1,
    width: "100%",
    marginVertical: 100,

    padding: 16,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
    marginTop: 20,
  },
  usersCountText: {
    fontSize: 18,
    fontFamily: "Poppins_400Regular",
    color: "#E2E8F0",
    textAlign: "center",
    marginBottom: 16,
  },
  noUsersText: {
    fontSize: 16,
    fontFamily: "Poppins_400Regular",
    color: "#CBD5E0",
    textAlign: "center",
    marginBottom: 16,
  },
  modeButtonsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 16,
  },
  modeButtonWrapper: {
    borderRadius: 10,
    overflow: "hidden",
  },
  modeButton: {
    width: 150,
    height: 50,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
  },
  buttonText: {
    position: "absolute",
    fontSize: 16,
    fontFamily: "Poppins_600SemiBold",
    color: "#1A202C",
    textAlign: "center",
  },
  sponsorContainer: {
    position: "absolute",
    bottom: 0,
    left: 24, // Matches overlay's 24px padding
    right: 24, // Matches overlay's 24px padding
    // Alternative Option 2:
    // width: Dimensions.get("window").width - 48,
    // marginHorizontal: 24,
    height: 100,
    padding: 10,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 15,
  },
  sponsorImage: {
    width: "100%",
    height: "100%",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  alertModal: {
    width: 300,
    height: 200,
    borderRadius: 16,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  alertTitle: {
    fontSize: 20,
    fontFamily: "Poppins_600SemiBold",
    color: "#fff",
    marginBottom: 8,
    textAlign: "center",
  },
  alertMessage: {
    fontSize: 14,
    fontFamily: "Poppins_400Regular",
    color: "#E2E8F0",
    textAlign: "center",
    marginBottom: 16,
  },
  alertButton: {
    backgroundColor: "#fff",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  alertButtonText: {
    fontSize: 16,
    fontFamily: "Poppins_600SemiBold",
    color: "#1A202C",
  },
});
