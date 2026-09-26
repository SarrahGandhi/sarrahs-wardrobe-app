import { router, useLocalSearchParams } from "expo-router";
import { StyleSheet } from "react-native";
import { EditorialPhoto } from "@/components/EditorialPhoto";
import {
  AppText,
  Card,
  EmptyState,
  IconButton,
  Screen,
  SectionHeader,
} from "@/components/ui";
import { previewLooks } from "@/mocks/editorial";

export function LookPreviewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const look = previewLooks.find((item) => item.id === id);
  const goBack = () =>
    router.canGoBack() ? router.back() : router.replace("/saved");
  return (
    <Screen bottomInset>
      <IconButton
        icon="arrow-back"
        accessibilityLabel="Back to looks"
        onPress={goBack}
        style={styles.back}
      />
      {look ? (
        <>
          <SectionHeader
            eyebrow={look.occasion.toUpperCase()}
            title={look.title}
            subtitle={look.savedLabel}
          />
          <EditorialPhoto
            source={look.image}
            description={look.imageDescription}
            style={styles.photo}
          />
          <Card>
            <SectionHeader title="The details" subtitle={look.notes} />
            {look.pieces.map((piece) => (
              <AppText key={piece} muted>
                — {piece}
              </AppText>
            ))}
          </Card>
          <AppText variant="caption" muted>
            Sample styling inspiration. These are preview pieces, not items from
            your wardrobe.
          </AppText>
        </>
      ) : (
        <EmptyState
          icon="bookmark-outline"
          title="Look not found"
          description="This sample look is no longer available."
          action={{
            label: "Explore saved looks",
            onPress: () => router.replace("/saved"),
          }}
        />
      )}
    </Screen>
  );
}
const styles = StyleSheet.create({
  back: { alignSelf: "flex-start" },
  photo: { aspectRatio: 0.8, borderRadius: 24 },
});
