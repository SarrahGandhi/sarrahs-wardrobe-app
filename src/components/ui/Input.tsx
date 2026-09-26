import { useId, useState } from "react";
import { StyleSheet, TextInput, View, type TextInputProps } from "react-native";
import { theme } from "@/constants/theme";
import { AppText } from "./AppText";

interface InputProps extends TextInputProps {
  label: string;
  hint?: string;
  error?: string;
}
export function Input({
  label,
  hint,
  error,
  style,
  onFocus,
  onBlur,
  ...props
}: InputProps) {
  const [focused, setFocused] = useState(false);
  const id = useId();
  return (
    <View style={styles.container}>
      <AppText nativeID={id} variant="caption" style={styles.label}>
        {label}
      </AppText>
      <TextInput
        {...props}
        accessibilityLabel={props.accessibilityLabel ?? label}
        accessibilityLabelledBy={id}
        accessibilityHint={error ?? hint}
        placeholderTextColor={theme.colors.muted}
        selectionColor={theme.colors.accent}
        onFocus={(event) => {
          setFocused(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          onBlur?.(event);
        }}
        style={[
          styles.input,
          props.multiline && styles.multiline,
          focused && styles.focused,
          error && styles.errorBorder,
          props.editable === false && styles.disabled,
          style,
        ]}
      />
      {error ? (
        <AppText
          variant="caption"
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
          style={styles.error}
        >
          {error}
        </AppText>
      ) : hint ? (
        <AppText variant="caption" muted>
          {hint}
        </AppText>
      ) : null}
    </View>
  );
}
const styles = StyleSheet.create({
  container: { gap: 8 },
  label: { fontWeight: "600" },
  input: {
    minHeight: 52,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.line,
    color: theme.colors.ink,
    backgroundColor: theme.colors.surface,
    fontSize: 16,
    lineHeight: 24,
  },
  multiline: { minHeight: 120, textAlignVertical: "top" },
  focused: { borderColor: theme.colors.accent },
  errorBorder: { borderColor: theme.colors.error },
  error: { color: theme.colors.error },
  disabled: { opacity: 0.65 },
});
