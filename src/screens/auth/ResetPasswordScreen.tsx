import { useState } from "react";
import { AuthForm } from "@/components/AuthForm";
import { Button, Input } from "@/components/ui";
import { useAuthAction } from "@/hooks/useAuthAction";
import { updatePassword, signOut } from "@/services/auth/authService";
import { validatePassword } from "@/utils/authValidation";

export function ResetPasswordScreen() {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [updated, setUpdated] = useState(false);
  const action = useAuthAction();
  const submit = () => {
    const error =
      validatePassword(password) ??
      (password !== confirmation ? "Your passwords do not match." : null);
    if (error) return action.setError(error);
    void action.run(async () => {
      await updatePassword(password);
      setPassword("");
      setConfirmation("");
      setUpdated(true);
      action.setMessage(
        "Your password has been updated. Return to login to sign in with your new password.",
      );
    });
  };
  return (
    <AuthForm
      title={updated ? "A fresh start." : "Choose a new password."}
      description={
        updated
          ? "Your new password is ready."
          : "Make it unique to your wardrobe account."
      }
      error={action.error}
      message={action.message}
    >
      {!updated ? (
        <>
          <Input
            label="New password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="new-password"
            autoCapitalize="none"
            hint="At least 8 characters."
            editable={!action.busy}
          />
          <Input
            label="Confirm new password"
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
            label="Update password"
            loading={action.busy}
            onPress={submit}
          />
        </>
      ) : null}
      <Button
        label={updated ? "Return to login" : "Cancel and log out"}
        variant={updated ? "primary" : "ghost"}
        disabled={action.busy}
        onPress={() => void action.run(signOut)}
      />
    </AuthForm>
  );
}
