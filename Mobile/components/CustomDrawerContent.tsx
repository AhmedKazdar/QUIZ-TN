import { useRouter } from "expo-router";
import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { DrawerContentComponentProps } from "@react-navigation/drawer";

const CustomDrawerContent = (props: DrawerContentComponentProps) => {
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await AsyncStorage.removeItem("token");
      await AsyncStorage.removeItem("username");
      await SecureStore.deleteItemAsync("userId");
      router.replace("/login");
    } catch (error) {
      console.error("Error clearing storage during logout:", error);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.avatarContainer}>
        <Image source={require("@/assets/avatar.png")} style={styles.avatar} />
        {/*  <Text style={styles.username}>John Doe</Text> */}
      </View>

      <View style={styles.menuContainer}>
        <TouchableOpacity onPress={() => router.push("/(drawer)")}>
          <Text style={styles.menuItem}>Home</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.push("/(drawer)/profile")}>
          <Text style={styles.menuItem}>Profile</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.push("/(drawer)/settings")}>
          <Text style={styles.menuItem}>Settings</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.logoutContainer}>
        <TouchableOpacity onPress={handleLogout}>
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 50,
    backgroundColor: "#fff",
  },
  avatarContainer: {
    alignItems: "center",
    marginBottom: 20,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  username: {
    marginTop: 10,
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
  },
  menuContainer: {
    marginTop: 20,
  },
  menuItem: {
    padding: 15,
    fontSize: 16,
    color: "#555",
  },
  logoutContainer: {
    padding: 20,
    borderTopWidth: 1,
    borderColor: "#eee",
  },
  logoutText: {
    color: "red",
    fontSize: 16,
    fontWeight: "bold",
  },
});

export default CustomDrawerContent;
