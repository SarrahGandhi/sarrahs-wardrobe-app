import { useState } from "react";
import { router } from "expo-router";
import { AuthForm } from "@/components/AuthForm";
import { Button, Input } from "@/components/ui";
import { useAuthAction } from "@/hooks/useAuthAction";
import { signIn, resendConfirmation } from "@/services/auth/authService";
import { validateEmail } from "@/utils/authValidation";

export function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const action = useAuthAction();
  const submit = () => {
    const error =
      validateEmail(email) ?? (!password ? "Enter your password." : null);
    if (error) return action.setError(error);
    void action.run(async () => {
      await signIn(email, password);
    });
  };
  return (
    <AuthForm
      title="Welcome back."
      description="Your wardrobe, right where you left it."
      error={action.error}
      message={action.message}
    >
      <Input
        label="Email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoComplete="email"
        autoCapitalize="none"
        autoCorrect={false}
        editable={!action.busy}
      />
      <Input
        label="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="current-password"
        autoCapitalize="none"
        editable={!action.busy}
        returnKeyType="go"
        onSubmitEditing={submit}
      />
      <Button label="Log in" loading={action.busy} onPress={submit} />
      <Button
        label="Forgot password?"
        variant="ghost"
        disabled={action.busy}
        onPress={() => router.push("/forgot-password")}
      />
      <Button
        label="Create an account"
        variant="secondary"
        disabled={action.busy}
        onPress={() => router.push("/signup")}
      />
      {action.error?.startsWith("Confirm your email") ? (
        <Button
          label="Resend confirmation email"
          variant="ghost"
          disabled={action.busy}
          onPress={() =>
            void action.run(async () => {
              await resendConfirmation(email);
              action.setMessage(
                "Check your inbox for a new confirmation link. Open it on this device.",
              );
            })
          }
        />
      ) : null}
    </AuthForm>
  );
}
