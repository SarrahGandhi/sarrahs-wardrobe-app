import { Pressable, StyleSheet, View } from "react-native";
import { theme } from "@/constants/theme";
import { AppText } from "./AppText";

interface ChipProps {
  label: string;
  selected?: boolean;
  disabled?: boolean;
  onPress?: () => void;
}
export function Chip({
  label,
  selected = false,
  disabled = false,
  onPress,
}: ChipProps) {
  const text = (
    <AppText variant="caption" style={selected && styles.selectedText}>
      {label}
    </AppText>
  );
  if (!onPress)
    return (
      <View style={[styles.chip, selected && styles.selected]}>{text}</View>
    );
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        styles.interactive,
        selected && styles.selected,
        (pressed || disabled) && { opacity: 0.5 },
      ]}
    >
      {text}
    </Pressable>
  );
}
const styles = StyleSheet.create({
  chip: {
    alignSelf: "flex-start",
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surface,
  },
  interactive: { minHeight: 48, justifyContent: "center" },
  selected: { backgroundColor: theme.colors.accent },
  selectedText: { color: theme.colors.white },
});
