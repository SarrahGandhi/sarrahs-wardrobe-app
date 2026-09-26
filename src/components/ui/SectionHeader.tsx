import { StyleSheet, View } from "react-native";
import { AppText } from "./AppText";

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  eyebrow?: string;
}
export function SectionHeader({
  title,
  subtitle,
  eyebrow,
}: SectionHeaderProps) {
  return (
    <View style={styles.header}>
      {eyebrow ? (
        <AppText variant="eyebrow" muted>
          {eyebrow}
        </AppText>
      ) : null}
      <AppText variant="heading" accessibilityRole="header">
        {title}
      </AppText>
      {subtitle ? <AppText muted>{subtitle}</AppText> : null}
    </View>
  );
}
const styles = StyleSheet.create({ header: { gap: 8 } });
