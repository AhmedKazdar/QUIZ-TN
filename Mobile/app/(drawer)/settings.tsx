// app/(drawer)/settings.tsx
import { useTheme } from "@react-navigation/native";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

export default function SettingsScreen() {
  const { colors } = useTheme();
  return (
    <View style={[styles.container, { backgroundColor: "#fff" }]}>
      <Text style={[styles.title, { color: colors.text }]}>
        Settings Profile
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: "600",
  },
});
