import type { PropsWithChildren } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { theme } from "@/constants/theme";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";

interface ScreenProps extends PropsWithChildren {
  scroll?: boolean;
  /** Tabs already own their bottom safe area. Enable for standalone screens. */
  bottomInset?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
}
export function Screen({
  children,
  scroll = true,
  bottomInset = false,
  contentStyle,
}: ScreenProps) {
  const { compact } = useResponsiveLayout();
  const content = [
    styles.content,
    { paddingHorizontal: compact ? 20 : 24 },
    contentStyle,
  ];
  return (
    <SafeAreaView
      style={styles.root}
      edges={
        bottomInset
          ? ["top", "left", "right", "bottom"]
          : ["top", "left", "right"]
      }
    >
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {scroll ? (
          <ScrollView
            contentContainerStyle={content}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={
              Platform.OS === "ios" ? "interactive" : "on-drag"
            }
            showsVerticalScrollIndicator={false}
          >
            {children}
          </ScrollView>
        ) : (
          <View style={content}>{children}</View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  flex: { flex: 1 },
  content: {
    flexGrow: 1,
    width: "100%",
    maxWidth: theme.layout.maxWidth,
    alignSelf: "center",
    paddingTop: 24,
    paddingBottom: 32,
    gap: 28,
  },
});
