import { View, StyleSheet } from "react-native";
import { AppText } from "./ui";

interface PageHeadingProps {
  eyebrow: string;
  title: string;
  description: string;
}
export function PageHeading({ eyebrow, title, description }: PageHeadingProps) {
  return (
    <View style={styles.heading}>
      <AppText variant="eyebrow" muted>
        {eyebrow}
      </AppText>
      <AppText variant="title" accessibilityRole="header">
        {title}
      </AppText>
      <AppText muted>{description}</AppText>
    </View>
  );
}
const styles = StyleSheet.create({ heading: { gap: 12 } });
