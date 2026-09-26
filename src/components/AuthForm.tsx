import type { PropsWithChildren } from "react";
import { StyleSheet, View } from "react-native";
import { PageHeading } from "./PageHeading";
import { AppText, Card, Screen } from "./ui";
import { theme } from "@/constants/theme";

interface AuthFormProps extends PropsWithChildren {
  title: string;
  description: string;
  error?: string | null;
  message?: string | null;
}
export function AuthForm({
  title,
  description,
  error,
  message,
  children,
}: AuthFormProps) {
  return (
    <Screen bottomInset contentStyle={styles.screen}>
      <AppText variant="eyebrow" muted>
        SARRAH’S WARDROBE
      </AppText>
      <PageHeading
        eyebrow="YOUR PERSONAL EDIT"
        title={title}
        description={description}
      />
      <Card>
        {error ? (
          <AppText
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
            style={styles.error}
          >
            {error}
          </AppText>
        ) : null}
        {message ? (
          <AppText accessibilityLiveRegion="polite" style={styles.message}>
            {message}
          </AppText>
        ) : null}
        <View style={styles.fields}>{children}</View>
      </Card>
    </Screen>
  );
}
const styles = StyleSheet.create({
  screen: { paddingTop: 40 },
  fields: { gap: 18 },
  error: { color: theme.colors.error },
  message: { color: theme.colors.accent },
});
