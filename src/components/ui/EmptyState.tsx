import Ionicons from "@expo/vector-icons/Ionicons";
import { StyleSheet, View } from "react-native";
import { theme } from "@/constants/theme";
import type { IconName } from "@/types/ui";
import { AppText } from "./AppText";
import { Button } from "./Button";

interface EmptyStateProps {
  icon: IconName;
  title: string;
  description: string;
  action?: { label: string; onPress: () => void };
}
export function EmptyState({
  icon,
  title,
  description,
  action,
}: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <View style={styles.icon}>
        <Ionicons
          name={icon}
          size={32}
          color={theme.colors.accent}
          accessible={false}
        />
      </View>
      <AppText
        variant="heading"
        accessibilityRole="header"
        style={styles.center}
      >
        {title}
      </AppText>
      <AppText muted style={styles.center}>
        {description}
      </AppText>
      {action ? (
        <Button
          label={action.label}
          onPress={action.onPress}
          variant="secondary"
        />
      ) : null}
    </View>
  );
}
const styles = StyleSheet.create({
  container: { paddingVertical: 32, gap: 16, alignItems: "center" },
  icon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: theme.colors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  center: { textAlign: "center", maxWidth: 360 },
});
