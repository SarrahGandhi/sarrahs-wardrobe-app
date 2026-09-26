import { ActivityIndicator, StyleSheet, View } from "react-native";
import { theme } from "@/constants/theme";
import { AppText } from "./AppText";

export function LoadingState({ label = "Just a moment…" }: { label?: string }) {
  return (
    <View
      style={styles.container}
      accessible
      accessibilityLabel={label}
      accessibilityState={{ busy: true }}
      accessibilityLiveRegion="polite"
    >
      <ActivityIndicator size="large" color={theme.colors.accent} />
      <AppText muted>{label}</AppText>
    </View>
  );
}
const styles = StyleSheet.create({
  container: { padding: 32, alignItems: "center", gap: 16 },
});
