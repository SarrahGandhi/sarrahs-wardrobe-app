import { StyleSheet, View } from "react-native";
import { PageHeading } from "@/components/PageHeading";
import { AppText, Screen } from "@/components/ui";
import { LookCard } from "@/components/LookCard";
import { previewLooks } from "@/mocks/editorial";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";

export function SavedScreen() {
  const { largeText } = useResponsiveLayout();
  return (
    <Screen>
      <PageHeading
        eyebrow="THE LOOKBOOK"
        title="Worth repeating"
        description="A little collection of looks you love."
      />
      <View style={[styles.grid, largeText && styles.stacked]}>
        {previewLooks.map((look) => (
          <LookCard key={look.id} look={look} />
        ))}
      </View>
      <AppText variant="caption" muted>
        Sample looks for this preview. Your own saved outfits will live here.
      </AppText>
    </Screen>
  );
}
const styles = StyleSheet.create({
  grid: { flexDirection: "row", gap: 14 },
  stacked: { flexDirection: "column" },
});
