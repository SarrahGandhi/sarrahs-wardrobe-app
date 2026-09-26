import { Platform } from "react-native";

export const theme = {
  colors: {
    background: "#F7F4EF",
    surface: "#FFFDFA",
    ink: "#292B27",
    muted: "#696960",
    accent: "#53624C",
    accentSoft: "#E7EBDD",
    blush: "#EDE0D7",
    line: "#DEDAD2",
    white: "#FFFFFF",
    error: "#A13232",
  },
  spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 },
  radius: { sm: 12, md: 20, lg: 28, pill: 999 },
  fonts: {
    editorial: Platform.select({
      ios: "Georgia",
      android: "serif",
      default: "Georgia, serif",
    }),
  },
  layout: { maxWidth: 720, minimumTouchTarget: 48 },
  shadows: {
    soft: {
      shadowColor: "#302D25",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.045,
      shadowRadius: 12,
      elevation: 2,
    },
  },
} as const;
