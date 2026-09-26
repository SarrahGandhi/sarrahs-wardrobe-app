import Ionicons from "@expo/vector-icons/Ionicons";
import { Tabs } from "expo-router/js-tabs";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { theme } from "@/constants/theme";
import { tabs } from "@/navigation/tabs";

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.accent,
        tabBarInactiveTintColor: theme.colors.muted,
        tabBarHideOnKeyboard: true,
        tabBarLabelPosition: "below-icon",
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopWidth: 0,
          height: 76 + insets.bottom,
          paddingBottom: Math.max(insets.bottom, 8),
          paddingTop: 8,
          shadowColor: theme.colors.ink,
          shadowOpacity: 0.06,
          shadowOffset: { width: 0, height: -4 },
          shadowRadius: 14,
          elevation: 8,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "500", marginTop: 5 },
        tabBarIconStyle: { height: 38 },
        tabBarItemStyle: { paddingVertical: 2 },
      }}
    >
      {tabs.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.title,
            tabBarAccessibilityLabel: tab.title,
            tabBarIcon: ({ focused, color, size }) => (
              <View
                style={
                  tab.name === "plan"
                    ? [styles.plan, focused && styles.planActive]
                    : styles.icon
                }
              >
                <Ionicons
                  name={focused ? tab.activeIcon : tab.icon}
                  size={tab.name === "plan" ? 22 : Math.min(size, 23)}
                  color={tab.name === "plan" ? theme.colors.white : color}
                  accessible={false}
                />
              </View>
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
const styles = StyleSheet.create({
  icon: { height: 38, alignItems: "center", justifyContent: "center" },
  plan: {
    width: 54,
    height: 38,
    borderRadius: 19,
    backgroundColor: theme.colors.accent,
    alignItems: "center",
    justifyContent: "center",
    ...theme.shadows.soft,
  },
  planActive: { backgroundColor: theme.colors.ink },
});
