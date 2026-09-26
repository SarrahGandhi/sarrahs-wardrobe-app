import { Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { AppText } from "./ui";
import { theme } from "@/constants/theme";
import type { IconName } from "@/types/ui";

interface HomeShortcutProps {
  title: string;
  description: string;
  icon: IconName;
  onPress: () => void;
  tinted?: boolean;
}
export function HomeShortcut({
  title,
  description,
  icon,
  onPress,
  tinted,
}: HomeShortcutProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${description}`}
      style={({ pressed }) => [
        styles.card,
        tinted && styles.tinted,
        pressed && { opacity: 0.75 },
      ]}
    >
      <View style={styles.top}>
        <Ionicons
          name={icon}
          size={24}
          color={theme.colors.accent}
          accessible={false}
        />
        <Ionicons
          name="arrow-forward"
          size={18}
          color={theme.colors.muted}
          accessible={false}
        />
      </View>
      <View style={styles.copy}>
        <AppText variant="heading" style={styles.title}>
          {title}
        </AppText>
        <AppText variant="caption" muted>
          {description}
        </AppText>
      </View>
    </Pressable>
  );
}
const styles = StyleSheet.create({
  card: {
    flex: 1,
    padding: 20,
    minHeight: 156,
    borderRadius: 22,
    backgroundColor: theme.colors.surface,
    gap: 24,
    ...theme.shadows.soft,
  },
  tinted: { backgroundColor: theme.colors.accentSoft },
  top: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  copy: { gap: 5 },
  title: { fontSize: 23, lineHeight: 29 },
});
