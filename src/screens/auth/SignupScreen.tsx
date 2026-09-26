import { useState } from "react";
import { router } from "expo-router";
import { AuthForm } from "@/components/AuthForm";
import { Button, Input } from "@/components/ui";
import { useAuthAction } from "@/hooks/useAuthAction";
import {
  signUp,
  resendConfirmation,
  verifyEmailCode,
} from "@/services/auth/authService";
import { validateEmail, validatePassword } from "@/utils/authValidation";

export function SignupScreen() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState("");
  const action = useAuthAction();
  const submit = () => {
    const error =
      !name.trim() || name.trim().length > 100
        ? "Enter a display name between 1 and 100 characters."
        : (validateEmail(email) ??
          validatePassword(password) ??
          (password !== confirmation ? "Your passwords do not match." : null));
    if (error) return action.setError(error);
    void action.run(async () => {
      const result = await signUp(name, email, password);
      if (result.confirmationRequired) {
        setSent(true);
        setPassword("");
        setConfirmation("");
        action.setMessage(
          "Check your inbox. Enter the confirmation code below or open the link on this device. If you already have an account, log in instead.",
        );
      }
    });
  };
  return (
    <AuthForm
      title="A wardrobe of your own."
      description="Create an account to start your personal edit."
      error={action.error}
      message={action.message}
    >
      {!sent ? (
        <>
          <Input
            label="Display name"
            value={name}
            onChangeText={setName}
            maxLength={100}
            autoComplete="name"
            editable={!action.busy}
          />
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
            hint="At least 8 characters. Use a unique password."
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="new-password"
            autoCapitalize="none"
            editable={!action.busy}
          />
          <Input
            label="Confirm password"
            value={confirmation}
            onChangeText={setConfirmation}
            secureTextEntry
            autoComplete="new-password"
            autoCapitalize="none"
            editable={!action.busy}
            returnKeyType="go"
            onSubmitEditing={submit}
          />
          <Button
            label="Create account"
            loading={action.busy}
            onPress={submit}
          />
        </>
      ) : (
        <>
          <Input
            label="Confirmation code"
            value={code}
            onChangeText={setCode}
            autoComplete="one-time-code"
            keyboardType="number-pad"
            maxLength={6}
            editable={!action.busy}
          />
          <Button
            label="Confirm email"
            loading={action.busy}
            onPress={() => {
              if (!/^\d{6}$/.test(code))
                return action.setError(
                  "Enter the 6-digit code from your email.",
                );
              void action.run(() => verifyEmailCode(email, code, "signup"));
            }}
          />
          <Button
            label="Resend confirmation"
            loading={action.busy}
            onPress={() =>
              void action.run(async () => {
                await resendConfirmation(email);
                action.setMessage(
                  "If confirmation is needed, a new code and link are on their way.",
                );
              })
            }
          />
        </>
      )}
      <Button
        label="Back to login"
        variant="ghost"
        disabled={action.busy}
        onPress={() => router.replace("/login")}
      />
    </AuthForm>
  );
}
