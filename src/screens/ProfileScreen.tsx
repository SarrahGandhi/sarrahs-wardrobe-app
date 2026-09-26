import { StyleSheet, View } from "react-native";
import { PageHeading } from "@/components/PageHeading";
import {
  AppText,
  Button,
  Card,
  Chip,
  LoadingState,
  Screen,
  SectionHeader,
} from "@/components/ui";
import { stylePreferences } from "@/constants/wardrobe";
import { theme } from "@/constants/theme";

import { useAuth } from "@/providers/AuthProvider";
import { useAuthAction } from "@/hooks/useAuthAction";
import { signOut } from "@/services/auth/authService";

export function ProfileScreen() {
  const { profile, user, profileLoading, profileError, reloadProfile } =
    useAuth();
  const action = useAuthAction();
  return (
    <Screen>
      <PageHeading
        eyebrow="THE PERSONAL DETAILS"
        title="Style, on your terms"
        description="A space for what feels most like you."
      />
      <Card style={styles.signature}>
        <View style={styles.monogram}>
          <AppText variant="heading">S / W</AppText>
        </View>
        <SectionHeader
          title={profile?.display_name || "Entirely your own"}
          subtitle={user?.email}
        />
      </Card>
      {profileLoading ? <LoadingState label="Loading your profile…" /> : null}
      {profileError ? (
        <Card>
          <AppText accessibilityRole="alert">{profileError}</AppText>
          <Button
            label="Retry profile"
            onPress={reloadProfile}
            variant="secondary"
          />
        </Card>
      ) : null}
      <SectionHeader
        title="Find your style language"
        subtitle="A preview of the preferences you’ll be able to make your own."
      />
      <View style={styles.wrap}>
        {stylePreferences.map((label) => (
          <Chip key={label} label={label} />
        ))}
      </View>
      <Card>
        <AppText variant="eyebrow" muted>
          MADE FOR THE WAY YOU DRESS
        </AppText>
        <AppText>
          From “no heels” to “a little more colour,” your must-haves and
          nice-to-haves will each have their place.
        </AppText>
        <AppText variant="caption" muted>
          Editable style preferences are coming in a future update.
        </AppText>
      </Card>
      {action.error ? (
        <AppText
          accessibilityRole="alert"
          style={{ color: theme.colors.error }}
        >
          {action.error}
        </AppText>
      ) : null}
      <Button
        label="Log out"
        variant="secondary"
        loading={action.busy}
        onPress={() => void action.run(signOut)}
      />
      <AppText variant="caption" muted style={styles.footer}>
        Sarrah’s Wardrobe · A more personal way to get dressed.
      </AppText>
    </Screen>
  );
}
const styles = StyleSheet.create({
  signature: { backgroundColor: theme.colors.blush },
  monogram: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: theme.colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  footer: { textAlign: "center" },
});
