import { useState } from "react";
import {
  Image,
  StyleSheet,
  View,
  type ImageSourcePropType,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { theme } from "@/constants/theme";
import { AppText } from "./ui";

interface EditorialPhotoProps {
  source: ImageSourcePropType;
  description: string;
  style?: StyleProp<ViewStyle>;
}
export function EditorialPhoto({
  source,
  description,
  style,
}: EditorialPhotoProps) {
  const [failed, setFailed] = useState(false);
  return (
    <View style={[styles.frame, style]}>
      {failed ? (
        <View
          style={styles.fallback}
          accessible
          accessibilityLabel={description}
        >
          <Ionicons name="image-outline" size={28} color={theme.colors.muted} />
          <AppText variant="caption" muted>
            Photo unavailable
          </AppText>
        </View>
      ) : (
        <Image
          source={source}
          accessibilityLabel={description}
          accessible
          resizeMode="cover"
          style={StyleSheet.absoluteFill}
          onError={() => setFailed(true)}
        />
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  frame: { backgroundColor: theme.colors.blush, overflow: "hidden" },
  fallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 12,
  },
});
