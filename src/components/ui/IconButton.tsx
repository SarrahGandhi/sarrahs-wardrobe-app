import Ionicons from "@expo/vector-icons/Ionicons";
import { Pressable, StyleSheet, type PressableProps } from "react-native";
import { theme } from "@/constants/theme";
import type { IconName } from "@/types/ui";

interface IconButtonProps extends Omit<
  PressableProps,
  "children" | "accessibilityLabel"
> {
  icon: IconName;
  accessibilityLabel: string;
}
export function IconButton({
  icon,
  style,
  disabled,
  ...props
}: IconButtonProps) {
  return (
    <Pressable
      {...props}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      style={(state) => [
        styles.button,
        state.pressed && { opacity: 0.65 },
        disabled && { opacity: 0.4 },
        typeof style === "function" ? style(state) : style,
      ]}
    >
      <Ionicons
        name={icon}
        size={22}
        color={theme.colors.ink}
        accessible={false}
      />
    </Pressable>
  );
}
const styles = StyleSheet.create({
  button: {
    minWidth: 48,
    minHeight: 48,
    borderRadius: 24,
    backgroundColor: theme.colors.surface,
    justifyContent: "center",
    alignItems: "center",
  },
});
