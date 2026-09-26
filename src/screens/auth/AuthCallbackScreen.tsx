import { useEffect, useState } from "react";
import { Redirect, router, useLocalSearchParams } from "expo-router";
import { AuthForm } from "@/components/AuthForm";
import { Button, LoadingState } from "@/components/ui";
import { completeAuthCallback } from "@/services/auth/callback";
import { signOut } from "@/services/auth/authService";
import { useAuth } from "@/providers/AuthProvider";
import { useAuthAction } from "@/hooks/useAuthAction";

export function AuthCallbackScreen() {
  const params = useLocalSearchParams<{
    code?: string;
    error?: string;
    error_code?: string;
    recovery?: string;
  }>();
  const { recoveryRequired, beginRecovery, session } = useAuth();
  const [result, setResult] = useState<{
    code: string | undefined;
    failed: boolean;
  } | null>(null);
  const done = result?.code === params.code && result?.failed === false;
  const failed = result?.code === params.code && result?.failed === true;
  const action = useAuthAction();
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        if (
          params.error ||
          params.error_code ||
          typeof params.code !== "string" ||
          !params.code
        )
          throw new Error("Invalid callback");
        await completeAuthCallback(params.code);
        if (params.recovery === "1") await beginRecovery();
        if (active) setResult({ code: params.code, failed: false });
      } catch {
        if (active) setResult({ code: params.code, failed: true });
      }
    })();
    return () => {
      active = false;
    };
  }, [
    params.code,
    params.error,
    params.error_code,
    params.recovery,
    beginRecovery,
  ]);
  if (done && session)
    return (
      <Redirect
        href={
          recoveryRequired || params.recovery === "1" ? "/reset-password" : "/"
        }
      />
    );
  return (
    <AuthForm
      title={failed ? "Let’s try a fresh link." : "One moment…"}
      description={
        failed
          ? "This link is expired, already used, or was opened on a different device. Request a new link from this app. If you just confirmed your email, you can also try logging in."
          : "We’re securely finishing your request."
      }
      error={action.error}
    >
      {failed ? (
        <Button
          label="Return to login"
          loading={action.busy}
          onPress={() =>
            void action.run(async () => {
              if (session) await signOut();
              router.replace("/login");
            })
          }
        />
      ) : (
        <LoadingState label="Verifying your link…" />
      )}
    </AuthForm>
  );
}
