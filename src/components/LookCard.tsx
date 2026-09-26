import { router } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { AppText } from "./ui";
import { EditorialPhoto } from "./EditorialPhoto";
import { theme } from "@/constants/theme";
import type { PreviewLook } from "@/types/look";

export function LookCard({ look }: { look: PreviewLook }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`View sample look: ${look.title}, ${look.occasion}`}
      onPress={() =>
        router.push({ pathname: "/looks/[id]", params: { id: look.id } })
      }
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View>
        <EditorialPhoto
          source={look.image}
          description={look.imageDescription}
          style={styles.photo}
        />
        <View style={styles.bookmark} pointerEvents="none">
          <Ionicons
            name="bookmark"
            size={16}
            color={theme.colors.ink}
            accessible={false}
          />
        </View>
      </View>
      <View style={styles.caption}>
        <AppText variant="caption" muted>
          {look.occasion}
        </AppText>
        <AppText variant="heading" style={styles.title}>
          {look.title}
        </AppText>
        <AppText variant="caption" muted>
          {look.savedLabel}
        </AppText>
      </View>
    </Pressable>
  );
}
const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    borderRadius: 20,
    ...theme.shadows.soft,
  },
  pressed: { opacity: 0.8 },
  photo: { aspectRatio: 0.72, borderRadius: 20 },
  bookmark: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.surface,
  },
  caption: { padding: 14, gap: 4 },
  title: { fontSize: 22, lineHeight: 28 },
});
