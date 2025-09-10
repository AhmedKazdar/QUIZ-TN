// app/(drawer)/_layout.tsx
import CustomDrawerContent from "@/components/CustomDrawerContent";
import { createDrawerNavigator } from "@react-navigation/drawer";
import React from "react";
import HomeScreen from ".";
import ProfileScreen from "./profile";
import QuizScreen from "./quiz";
import SettingsScreen from "./settings";

const Drawer = createDrawerNavigator();

export default function DrawerLayout() {
  return (
    <Drawer.Navigator
      screenOptions={{
        headerShown: true,
      }}
      drawerContent={(props) => <CustomDrawerContent {...props} />}
    >
      <Drawer.Screen
        name="index"
        options={{ title: "Home" }}
        component={HomeScreen}
      />
      <Drawer.Screen
        name="profile"
        options={{ title: "Profile" }}
        component={ProfileScreen}
      />
      <Drawer.Screen
        name="quiz"
        options={{ title: "Quiz" }}
        component={QuizScreen}
      />
      <Drawer.Screen
        name="settings"
        options={{ title: "Settings" }}
        component={SettingsScreen}
      />
    </Drawer.Navigator>
  );
}
