import { useRouter } from "expo-router";
import React from "react";
import { Image } from "react-native";
import Onboarding from "react-native-onboarding-swiper";

export default function OnboardingScreen() {
  const router = useRouter();

  const handleFinish = () => {
    router.replace("/register");
  };

  return (
    <Onboarding
      onSkip={handleFinish}
      onDone={handleFinish}
      pages={[
        {
          backgroundColor: "#fff",
          image: (
            <Image
              source={require("@/assets/onboarding1.png")}
              style={{ width: 250, height: 250 }}
            />
          ),
          title: "Welcome to Quiz App",
          subtitle: "Boost your knowledge in a fun way!",
        },
        {
          backgroundColor: "#fff",
          image: (
            <Image
              source={require("@/assets/onboarding2.png")}
              style={{ width: 250, height: 250 }}
            />
          ),
          title: "Practice Makes Perfect",
          subtitle: "Take quizzes, track progress, and level up!",
        },
        {
          backgroundColor: "#fff",
          image: (
            <Image
              source={require("@/assets/onboarding3.png")}
              style={{ width: 250, height: 250 }}
            />
          ),
          title: "Get Started Now",
          subtitle: "Join the challenge!",
        },
      ]}
    />
  );
}
