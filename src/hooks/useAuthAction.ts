import { useRef, useState } from "react";
import { Keyboard } from "react-native";
import { authErrorMessage } from "@/utils/authValidation";

export function useAuthAction() {
  const inFlight = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  async function run(action: () => Promise<void>) {
    if (inFlight.current) return;
    inFlight.current = true;
    Keyboard.dismiss();
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await action();
    } catch (cause) {
      setError(authErrorMessage(cause));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  return { busy, error, message, setError, setMessage, run };
}
