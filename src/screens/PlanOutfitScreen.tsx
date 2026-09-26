import { StyleSheet, View } from "react-native";
import { PageHeading } from "@/components/PageHeading";
import { AppText, Button, Card, Screen, SectionHeader } from "@/components/ui";
import { theme } from "@/constants/theme";

const steps = [
  {
    number: "01",
    title: "Set the scene",
    description: "The occasion, the weather, and how you want to feel.",
  },
  {
    number: "02",
    title: "Make it personal",
    description: "A favourite piece, a little direction, your non-negotiables.",
  },
  {
    number: "03",
    title: "Find your look",
    description:
      "Three complete outfits, ready for your own finishing touches.",
  },
] as const;

export function PlanOutfitScreen() {
  return (
    <Screen>
      <PageHeading
        eyebrow="YOUR PERSONAL STYLIST"
        title="A look for your life"
        description="Good style starts with you. We’ll take it from there."
      />
      <Card>
        {steps.map((step) => (
          <View key={step.number} style={styles.step}>
            <AppText variant="eyebrow" style={styles.number}>
              {step.number}
            </AppText>
            <View style={styles.copy}>
              <AppText variant="heading">{step.title}</AppText>
              <AppText muted>{step.description}</AppText>
            </View>
          </View>
        ))}
      </Card>
      <SectionHeader
        title="One brief. Three possibilities."
        subtitle="Safe Choice, More Stylish, and Something Different — all built around your own wardrobe."
      />
      <Card style={styles.note}>
        <AppText variant="eyebrow" muted>
          THE STYLIST IS COMING
        </AppText>
        <AppText>
          Outfit planning will be available in a future update. For now, take a
          look around your new space.
        </AppText>
        <Button label="Generate outfits · Coming soon" disabled />
      </Card>
    </Screen>
  );
}
const styles = StyleSheet.create({
  step: { flexDirection: "row", gap: 16, paddingVertical: 10 },
  number: { color: theme.colors.accent, paddingTop: 7 },
  copy: { flex: 1, gap: 8 },
  note: { backgroundColor: theme.colors.accentSoft },
});
