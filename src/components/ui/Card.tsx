import { View, StyleSheet, type ViewProps } from "react-native";
import { theme } from "@/constants/theme";

export function Card({ style, ...props }: ViewProps) {
  return <View {...props} style={[styles.card, style]} />;
}
const styles = StyleSheet.create({
  card: {
    padding: 24,
    gap: 16,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
  },
});
