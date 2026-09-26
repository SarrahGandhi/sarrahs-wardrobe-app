import { useWindowDimensions } from "react-native";

export function useResponsiveLayout() {
  const { width, fontScale } = useWindowDimensions();
  return {
    compact: width < 375,
    wide: width >= 600,
    largeText: fontScale > 1.3,
  };
}
