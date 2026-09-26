import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import {
  SafeAreaProvider,
  initialWindowMetrics,
} from "react-native-safe-area-context";
import { theme } from "@/constants/theme";
import { AuthProvider, useAuth } from "@/providers/AuthProvider";
import { Button, EmptyState, LoadingState, Screen } from "@/components/ui";
import { supabaseConfigurationError } from "@/services/supabase/client";

export { ErrorBoundary } from "expo-router";

function AuthenticatedNavigation() {
  const { session, restoring, restoreError, retryRestore, recoveryRequired } =
    useAuth();
  if (restoring)
    return (
      <Screen bottomInset>
        <LoadingState label="Opening your wardrobe…" />
      </Screen>
    );
  if (restoreError)
    return (
      <Screen bottomInset>
        <EmptyState
          icon="cloud-offline-outline"
          title={
            supabaseConfigurationError
              ? "Connect your wardrobe"
              : "Let’s reconnect"
          }
          description={restoreError}
        />
        {!supabaseConfigurationError ? (
          <Button label="Retry" onPress={retryRestore} />
        ) : null}
      </Screen>
    );
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.colors.background },
      }}
    >
      <Stack.Protected guard={!!session && !recoveryRequired}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="add-clothing" options={{ presentation: "modal" }} />
        <Stack.Screen name="looks/[id]" />
      </Stack.Protected>
      <Stack.Protected guard={!session}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
      <Stack.Protected guard={!!session && recoveryRequired}>
        <Stack.Screen name="reset-password" />
      </Stack.Protected>
      <Stack.Screen name="auth/callback" />
      <Stack.Screen name="+not-found" />
    </Stack>
  );
}
export default function RootLayout() {
  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <StatusBar style="dark" />
      <AuthProvider>
        <AuthenticatedNavigation />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
