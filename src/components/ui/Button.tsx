import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  type PressableProps,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { theme } from "@/constants/theme";
import type { ButtonVariant, IconName } from "@/types/ui";
import { AppText } from "./AppText";

interface ButtonProps extends Omit<PressableProps, "children"> {
  label: string;
  variant?: ButtonVariant;
  icon?: IconName;
  loading?: boolean;
}
export function Button({
  label,
  variant = "primary",
  icon,
  loading = false,
  disabled,
  style,
  ...props
}: ButtonProps) {
  const color = variant === "primary" ? theme.colors.white : theme.colors.ink;
  return (
    <Pressable
      {...props}
      accessibilityRole="button"
      accessibilityLabel={props.accessibilityLabel ?? label}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      disabled={disabled || loading}
      style={(state) => [
        styles.base,
        styles[variant],
        state.pressed && styles.pressed,
        (disabled || loading) && styles.disabled,
        typeof style === "function" ? style(state) : style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={color} />
      ) : icon ? (
        <Ionicons name={icon} size={19} color={color} accessible={false} />
      ) : null}
      <AppText
        style={{ color, fontWeight: "600", textAlign: "center", flexShrink: 1 }}
      >
        {label}
      </AppText>
    </Pressable>
  );
}
const styles = StyleSheet.create({
  base: {
    minHeight: 52,
    paddingVertical: 13,
    paddingHorizontal: 20,
    borderRadius: theme.radius.pill,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
  },
  primary: { backgroundColor: theme.colors.accent },
  secondary: { backgroundColor: theme.colors.accentSoft },
  ghost: { backgroundColor: "transparent" },
  pressed: { opacity: 0.75 },
  disabled: { opacity: 0.45 },
});
