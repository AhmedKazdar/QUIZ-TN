import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";

export default function Index() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkOnboarding = async () => {
      // const hasSeen = await AsyncStorage.getItem("hasSeenOnboarding");
      // if (hasSeen === "true") {
      //   router.replace("/(tabs)");
      // } else {
      //   router.replace("/onboarding");
      // }

      // Temporarily always go to onboarding
      router.replace("/onboarding");

      setLoading(false);
    };
    checkOnboarding();
  }, []);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return null;
}
