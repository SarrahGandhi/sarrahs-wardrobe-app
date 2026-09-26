import { StyleSheet, Text, type TextProps } from "react-native";
import { theme } from "@/constants/theme";

type Variant = "title" | "heading" | "body" | "caption" | "eyebrow";
interface AppTextProps extends TextProps {
  variant?: Variant;
  muted?: boolean;
}

export function AppText({
  variant = "body",
  muted,
  style,
  ...props
}: AppTextProps) {
  return (
    <Text
      {...props}
      style={[styles.base, styles[variant], muted && styles.muted, style]}
    />
  );
}
const styles = StyleSheet.create({
  base: { color: theme.colors.ink },
  title: { fontFamily: theme.fonts.editorial, fontSize: 38, lineHeight: 46 },
  heading: { fontFamily: theme.fonts.editorial, fontSize: 25, lineHeight: 33 },
  body: { fontSize: 16, lineHeight: 25 },
  caption: { fontSize: 13, lineHeight: 20 },
  eyebrow: {
    fontSize: 11,
    lineHeight: 18,
    fontWeight: "600",
    letterSpacing: 2,
  },
  muted: { color: theme.colors.muted },
});
