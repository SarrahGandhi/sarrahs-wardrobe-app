import { router } from "expo-router";
import { EmptyState, Screen } from "@/components/ui";

export default function NotFound() {
  return (
    <Screen bottomInset>
      <EmptyState
        icon="compass-outline"
        title="A little off the runway"
        description="This page doesn't exist. Let's get you back to your wardrobe."
        action={{ label: "Go home", onPress: () => router.replace("/") }}
      />
    </Screen>
  );
}
