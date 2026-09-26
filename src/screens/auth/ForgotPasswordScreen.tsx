import { useState } from "react";
import { router } from "expo-router";
import { AuthForm } from "@/components/AuthForm";
import { Button, Input } from "@/components/ui";
import { useAuthAction } from "@/hooks/useAuthAction";
import {
  requestPasswordReset,
  verifyEmailCode,
} from "@/services/auth/authService";
import { validateEmail } from "@/utils/authValidation";

export function ForgotPasswordScreen() {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const action = useAuthAction();
  const submit = () => {
    const error = validateEmail(email);
    if (error) return action.setError(error);
    void action.run(async () => {
      await requestPasswordReset(email);
      setSent(true);
      action.setMessage(
        "If an account exists for this email, a reset code and link are on their way. Enter the code below, or open the link on this device.",
      );
    });
  };
  return (
    <AuthForm
      title="Let’s get you back in."
      description="We’ll send you a link to choose a new password."
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
        editable={!action.busy && !sent}
        returnKeyType="send"
        onSubmitEditing={submit}
      />
      {sent ? (
        <>
          <Input
            label="Reset code"
            value={code}
            onChangeText={setCode}
            autoComplete="one-time-code"
            keyboardType="number-pad"
            maxLength={6}
            editable={!action.busy}
          />
          <Button
            label="Verify reset code"
            loading={action.busy}
            onPress={() => {
              if (!/^\d{6}$/.test(code))
                return action.setError(
                  "Enter the 6-digit code from your email.",
                );
              void action.run(() => verifyEmailCode(email, code, "recovery"));
            }}
          />
        </>
      ) : null}
      <Button
        label={sent ? "Resend reset email" : "Send reset email"}
        loading={action.busy}
        onPress={submit}
      />
      <Button
        label="Back to login"
        variant="ghost"
        disabled={action.busy}
        onPress={() => router.replace("/login")}
      />
    </AuthForm>
  );
}
