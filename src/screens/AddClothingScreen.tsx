import { router } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { StyleSheet, View } from "react-native";
import { PageHeading } from "@/components/PageHeading";
import { AppText, Card, IconButton, Screen } from "@/components/ui";
import { theme } from "@/constants/theme";
import type { IconName } from "@/types/ui";

const methods: { title: string; description: string; icon: IconName }[] = [
  {
    title: "Take a photo",
    description: "Capture a piece from your wardrobe.",
    icon: "camera-outline",
  },
  {
    title: "Upload a photo",
    description: "Choose an image you already have.",
    icon: "images-outline",
  },
  {
    title: "Find it online",
    description: "Look up a piece by name or brand.",
    icon: "search-outline",
  },
  {
    title: "Paste a product link",
    description: "Bring a favourite find into your collection.",
    icon: "link-outline",
  },
];
export function AddClothingScreen() {
  return (
    <Screen bottomInset>
      <IconButton
        icon="close-outline"
        accessibilityLabel="Close add clothing"
        onPress={() =>
          router.canGoBack() ? router.back() : router.replace("/")
        }
        style={styles.close}
      />
      <PageHeading
        eyebrow="GROW YOUR COLLECTION"
        title="Every piece has potential."
        description="A well-loved jacket. Your perfect jeans. Start with something you love."
      />
      <Card>
        {methods.map((method) => (
          <View key={method.title} style={styles.method}>
            <View style={styles.icon}>
              <Ionicons
                name={method.icon}
                size={24}
                color={theme.colors.accent}
                accessible={false}
              />
            </View>
            <View style={styles.copy}>
              <AppText variant="heading" style={styles.title}>
                {method.title}
              </AppText>
              <AppText variant="caption" muted>
                {method.description}
              </AppText>
            </View>
          </View>
        ))}
      </Card>
      <AppText variant="caption" muted>
        Coming soon. This is a preview of the ways you’ll be able to add
        clothing.
      </AppText>
    </Screen>
  );
}
const styles = StyleSheet.create({
  close: { alignSelf: "flex-end" },
  method: {
    flexDirection: "row",
    gap: 16,
    alignItems: "center",
    paddingVertical: 12,
  },
  icon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.colors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  copy: { flex: 1, gap: 4 },
  title: { fontSize: 22, lineHeight: 28 },
});
