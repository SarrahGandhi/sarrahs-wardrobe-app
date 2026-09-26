import { StyleSheet, View } from "react-native";
import { PageHeading } from "@/components/PageHeading";
import {
  AppText,
  Card,
  Chip,
  EmptyState,
  Screen,
  SectionHeader,
} from "@/components/ui";
import { wardrobeCategories } from "@/constants/wardrobe";

export function WardrobeScreen() {
  return (
    <Screen>
      <PageHeading
        eyebrow="THE COLLECTION"
        title="Your wardrobe"
        description="Everything you love to wear, in one considered space."
      />
      <Card>
        <EmptyState
          icon="shirt-outline"
          title="Room for your favourites"
          description="Your collection will begin here. Adding pieces is coming in a future update."
        />
      </Card>
      <SectionHeader
        title="A place for every piece"
        subtitle="From everyday essentials to the finishing touches."
      />
      <View style={styles.wrap}>
        {wardrobeCategories.map((label) => (
          <Chip key={label} label={label} />
        ))}
      </View>
      <Card>
        <AppText variant="eyebrow" muted>
          COMING TO YOUR WARDROBE
        </AppText>
        <AppText>
          Capture a photo, upload an image, find a product online, or add a
          link.
        </AppText>
        <AppText variant="caption" muted>
          You’ll be able to review and correct every item before it joins your
          collection.
        </AppText>
      </Card>
    </Screen>
  );
}
const styles = StyleSheet.create({
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
});
