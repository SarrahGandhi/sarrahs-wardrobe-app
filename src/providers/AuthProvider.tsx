import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";
import { AppState, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Session } from "@supabase/supabase-js";
import {
  supabase,
  supabaseConfigurationError,
} from "@/services/supabase/client";
import { getProfile } from "@/services/supabase/profiles";
import type { AuthUser, UserProfile } from "@/types/user";

const recoveryKey = "wardrobe:password-recovery";
interface AuthContextValue {
  session: Session | null;
  user: AuthUser | null;
  profile: UserProfile | null;
  restoring: boolean;
  restoreError: string | null;
  retryRestore: () => void;
  profileLoading: boolean;
  profileError: string | null;
  reloadProfile: () => void;
  recoveryRequired: boolean;
  beginRecovery: () => Promise<void>;
}
const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [restoring, setRestoring] = useState(!!supabase);
  const [restoreError, setRestoreError] = useState<string | null>(
    supabaseConfigurationError,
  );
  const [restoreAttempt, setRestoreAttempt] = useState(0);
  const [recoveryRequired, setRecoveryRequired] = useState(false);
  const [profileResult, setProfileResult] = useState<{
    userId: string;
    attempt: number;
    data: UserProfile | null;
    error: string | null;
  } | null>(null);
  const [profileAttempt, setProfileAttempt] = useState(0);
  // Serialize storage writes so a delayed recovery write cannot undo logout.
  const recoveryWrite = useRef(Promise.resolve());
  const persistRecovery = useCallback((required: boolean) => {
    const write = recoveryWrite.current
      .catch(() => {})
      .then(() =>
        required
          ? AsyncStorage.setItem(recoveryKey, "1")
          : AsyncStorage.removeItem(recoveryKey),
      );
    recoveryWrite.current = write;
    return write;
  }, []);
  const beginRecovery = useCallback(async () => {
    await persistRecovery(true);
    setRecoveryRequired(true);
  }, [persistRecovery]);

  useEffect(() => {
    if (!supabase) return;
    const client = supabase;
    let active = true;
    let revision = 0;
    let recoveryChanged = false;
    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((event, nextSession) => {
      if (!active || event === "INITIAL_SESSION") return;
      revision++;
      setSession(nextSession);
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_OUT") {
        recoveryChanged = true;
        const required = event === "PASSWORD_RECOVERY";
        setRecoveryRequired(required);
        void persistRecovery(required).catch(() => {
          if (active)
            setRestoreError(
              "Your session could not be stored safely. Please retry.",
            );
        });
      }
    });
    void (async () => {
      try {
        const [result, recovery] = await Promise.all([
          client.auth.getSession(),
          AsyncStorage.getItem(recoveryKey),
        ]);
        if (result.error) throw result.error;
        if (!active) return;
        if (revision === 0) {
          setSession(result.data.session);
        }
        if (!recoveryChanged)
          setRecoveryRequired(!!result.data.session && recovery === "1");
      } catch {
        if (active)
          setRestoreError(
            "We couldn’t restore your session. Check your connection and try again.",
          );
      } finally {
        if (active) setRestoring(false);
      }
    })();
    const syncRefresh = (state: string) => {
      if (state === "active") client.auth.startAutoRefresh();
      else client.auth.stopAutoRefresh();
    };
    const appStateSubscription =
      Platform.OS !== "web"
        ? AppState.addEventListener("change", syncRefresh)
        : null;
    if (Platform.OS !== "web") syncRefresh(AppState.currentState);
    return () => {
      active = false;
      subscription.unsubscribe();
      appStateSubscription?.remove();
      if (Platform.OS !== "web") client.auth.stopAutoRefresh();
    };
  }, [restoreAttempt, persistRecovery]);

  const userId = session?.user.id;
  useEffect(() => {
    let active = true;
    if (userId)
      void getProfile(userId)
        .then((data) => {
          if (active)
            setProfileResult({
              userId,
              attempt: profileAttempt,
              data,
              error: null,
            });
        })
        .catch(() => {
          if (active)
            setProfileResult({
              userId,
              attempt: profileAttempt,
              data: null,
              error:
                "Your profile could not be loaded. Check your connection and try again.",
            });
        });
    return () => {
      active = false;
    };
  }, [userId, profileAttempt]);
  const currentProfile =
    profileResult?.userId === userId &&
    profileResult?.attempt === profileAttempt
      ? profileResult
      : null;
  const profile = currentProfile?.data ?? null;
  const profileError = currentProfile?.error ?? null;
  const profileLoading = !!userId && !currentProfile;
  const retryRestore = useCallback(() => {
    setRestoreError(null);
    setRestoring(true);
    setRestoreAttempt((value) => value + 1);
  }, []);
  const reloadProfile = useCallback(
    () => setProfileAttempt((value) => value + 1),
    [],
  );
  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      // Do not expose the previous user's profile during an account switch.
      profile: profile?.id === userId ? profile : null,
      restoring,
      restoreError,
      retryRestore,
      profileLoading,
      profileError,
      reloadProfile,
      recoveryRequired,
      beginRecovery,
    }),
    [
      session,
      profile,
      userId,
      restoring,
      restoreError,
      retryRestore,
      profileLoading,
      profileError,
      reloadProfile,
      recoveryRequired,
      beginRecovery,
    ],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider.");
  return context;
}
