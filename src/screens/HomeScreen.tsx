import { router } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { AppText, Button, Screen } from "@/components/ui";
import { EditorialPhoto } from "@/components/EditorialPhoto";
import { HomeShortcut } from "@/components/HomeShortcut";
import { LookCard } from "@/components/LookCard";
import { theme } from "@/constants/theme";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import { editorialHero, previewLooks } from "@/mocks/editorial";

import { useAuth } from "@/providers/AuthProvider";

export function HomeScreen() {
  const { profile } = useAuth();
  const name = profile?.display_name.trim() || "there";
  const firstName = name.split(/\s+/)[0];
  const initials =
    profile?.display_name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "SW";
  const { compact, largeText } = useResponsiveLayout();
  return (
    <Screen contentStyle={styles.screen}>
      <View style={styles.header}>
        <View style={styles.greeting}>
          <AppText variant="eyebrow" muted>
            SARRAH’S WARDROBE
          </AppText>
          <AppText variant="heading">Hello, {firstName}.</AppText>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open your profile"
          onPress={() => router.navigate("/profile")}
          style={({ pressed }) => [styles.avatar, pressed && { opacity: 0.7 }]}
        >
          <AppText variant="caption" style={styles.initials}>
            {initials}
          </AppText>
        </Pressable>
      </View>

      <View style={styles.hero}>
        <View>
          <EditorialPhoto
            source={editorialHero}
            description="Black-and-white editorial portrait in an oversized blazer."
            style={[styles.heroPhoto, compact && { aspectRatio: 1.1 }]}
          />
          <View style={styles.edition}>
            <AppText variant="eyebrow">THE EVERYDAY EDIT</AppText>
          </View>
        </View>
        <View style={styles.heroCopy}>
          <AppText variant="eyebrow" muted>
            A LITTLE INSPIRATION, JUST FOR YOU
          </AppText>
          <AppText
            variant="title"
            accessibilityRole="header"
            style={[
              styles.heroTitle,
              compact && { fontSize: 33, lineHeight: 39 },
            ]}
          >
            What are you{"\n"}dressing for?
          </AppText>
          <AppText muted>Your plans. Your pieces. A fresh perspective.</AppText>
          <Button
            label="Plan an Outfit"
            icon="sparkles-outline"
            onPress={() => router.navigate("/plan")}
            style={styles.cta}
          />
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitle}>
            <AppText variant="eyebrow" muted>
              YOUR LOOKBOOK
            </AppText>
            <AppText variant="heading" accessibilityRole="header">
              Recently saved
            </AppText>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="View all saved looks"
            onPress={() => router.navigate("/saved")}
            style={({ pressed }) => [
              styles.textLink,
              pressed && { opacity: 0.6 },
            ]}
          >
            <AppText variant="caption" style={styles.linkText}>
              View all
            </AppText>
            <Ionicons
              name="arrow-forward"
              size={15}
              color={theme.colors.accent}
              accessible={false}
            />
          </Pressable>
        </View>
        <View style={[styles.row, largeText && styles.stacked]}>
          {previewLooks.map((look) => (
            <LookCard key={look.id} look={look} />
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <AppText variant="heading" accessibilityRole="header">
          Good style starts here.
        </AppText>
        <View style={[styles.row, (compact || largeText) && styles.stacked]}>
          <HomeShortcut
            title="Your wardrobe"
            description="Rediscover your favourites"
            icon="shirt-outline"
            onPress={() => router.navigate("/wardrobe")}
          />
          <HomeShortcut
            title="Add clothing"
            description="Make room for a new piece"
            icon="add-outline"
            tinted
            onPress={() => router.push("/add-clothing")}
          />
        </View>
      </View>
      <View style={styles.footer}>
        <AppText variant="heading" muted style={styles.signature}>
          Wear what makes you, you.
        </AppText>
        <AppText variant="caption" muted>
          Sample looks · A preview of your personal edit
        </AppText>
      </View>
    </Screen>
  );
}
const styles = StyleSheet.create({
  screen: { gap: 32, paddingTop: 20, paddingBottom: 28 },
  header: { flexDirection: "row", alignItems: "center", gap: 16 },
  greeting: { flex: 1, gap: 6 },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.colors.blush,
    alignItems: "center",
    justifyContent: "center",
  },
  initials: { letterSpacing: 1, fontWeight: "500" },
  hero: {
    borderRadius: 26,
    backgroundColor: theme.colors.surface,
    ...theme.shadows.soft,
  },
  heroPhoto: {
    aspectRatio: 1.2,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
  },
  edition: {
    position: "absolute",
    top: 18,
    left: 18,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: theme.colors.surface,
    borderRadius: 6,
  },
  heroCopy: { padding: 24, gap: 12 },
  heroTitle: { fontSize: 38, lineHeight: 43 },
  cta: { marginTop: 8 },
  section: { gap: 18 },
  sectionHeader: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  sectionTitle: { gap: 5 },
  textLink: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 4,
  },
  linkText: { color: theme.colors.accent, fontWeight: "600" },
  row: { flexDirection: "row", gap: 14, alignItems: "stretch" },
  stacked: { flexDirection: "column" },
  footer: { alignItems: "center", gap: 10, paddingVertical: 8 },
  signature: { fontSize: 21, fontStyle: "italic", textAlign: "center" },
});
