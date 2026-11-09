import { useCallback, useEffect, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import type { Composition } from "../domain/composition";
import { authReturn, supabase } from "./client";
import { authReturnUrl, validatePassword } from "./emailAuth";
import { deleteComposition, loadCompositions, loadProfile, saveComposition, saveProfile, type Profile, type SavedComposition } from "./repository";
import { canSaveComposition } from "./compositionLimit";

export function accountError(error: unknown): string {
  return error instanceof Error ? error.message : typeof error === "object" && error !== null && "message" in error ? String(error.message) : "Something went wrong. Please try again.";
}

export function useAccount() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(!!supabase);
  const [dataLoading, setDataLoading] = useState(false);
  const [error, setError] = useState("");
  const [recovery, setRecovery] = useState<"none" | "pending" | "ready" | "expired">(authReturn.kind === "recovery" ? authReturn.hasError ? "expired" : "pending" : "none");
  const [authError, setAuthError] = useState(authReturn.hasError && authReturn.kind !== "recovery" ? "This email link has expired or is invalid. Please sign in or request another email." : "");
  const [data, setData] = useState<{ owner: string; profile: Profile; saved: SavedComposition[] } | null>(null);
  const owner = useRef<string | null>(null);
  const generation = useRef(0);
  const userId = user?.id;
  const initialName = typeof user?.user_metadata?.display_name === "string" ? user.user_metadata.display_name.slice(0, 80) : "";

  useEffect(() => {
    if (!supabase) return;
    let mounted = true, authChanged = false;
    const { data: subscription } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      authChanged = true;
      const previousOwner = owner.current;
      owner.current = session?.user.id ?? null;
      setUser(session?.user ?? null);
      setAuthLoading(false);
      if (event === "PASSWORD_RECOVERY" && session) {
        rememberRecovery(session.user.id);
        setRecovery("ready");
      } else if (event === "SIGNED_OUT") {
        rememberRecovery(null);
        setRecovery("none");
      } else if (previousOwner && previousOwner !== session?.user.id) {
        rememberRecovery(null);
        setRecovery("none");
      } else if (event === "INITIAL_SESSION") {
        const restored = !!session && recoveryOwner() === session.user.id;
        setRecovery(previous => previous === "ready" ? previous : restored ? "ready" : previous === "pending" ? "expired" : previous);
      }
    });
    void supabase.auth.getSession().then(({ data: sessionData, error: sessionError }) => {
      if (!mounted || authChanged) return;
      if (sessionError) setError(accountError(sessionError));
      owner.current = sessionData.session?.user.id ?? null;
      setUser(sessionData.session?.user ?? null);
      setAuthLoading(false);
      setRecovery(previous => previous === "pending" ? sessionData.session && recoveryOwner() === sessionData.session.user.id ? "ready" : "expired" : previous);
    }).catch(error => { if (mounted) { setAuthError(accountError(error)); setAuthLoading(false); setRecovery(previous => previous === "pending" ? "expired" : previous); } });
    return () => { mounted = false; subscription.subscription.unsubscribe(); };
  }, []);

  const refresh = useCallback(async () => {
    const current = ++generation.current;
    if (!supabase || !userId) { setData(null); setDataLoading(false); setError(""); return; }
    setDataLoading(true); setError("");
    try {
      const [profile, saved] = await Promise.all([
        loadProfile(supabase, userId).then(profile => profile ?? saveProfile(supabase!, userId, initialName)),
        loadCompositions(supabase, userId),
      ]);
      if (owner.current === userId && generation.current === current) setData({ owner: userId, profile, saved });
    } catch (error) {
      if (owner.current === userId && generation.current === current) setError(accountError(error));
    } finally {
      if (generation.current === current) setDataLoading(false);
    }
  }, [userId, initialName]);

  useEffect(() => { void refresh(); return () => { generation.current++; }; }, [refresh]);

  async function signIn(email: string, password: string) {
    if (!supabase) throw new Error("Account sign-in is not available yet.");
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) throw error;
  }
  async function signUp(email: string, password: string, name: string) {
    if (!supabase) throw new Error("Account sign-in is not available yet.");
    validatePassword(password, password);
    const displayName = name.trim();
    if (!displayName || displayName.length > 80) throw new Error("Enter a display name with 1–80 characters.");
    const { data, error } = await supabase.auth.signUp({ email: email.trim(), password,
      options: { data: { display_name: displayName }, emailRedirectTo: authReturnUrl("confirm", window.location.href) } });
    if (error) throw error;
    return !data.session;
  }
  async function resendConfirmation(email: string) {
    if (!supabase) throw new Error("Account sign-in is not available yet.");
    const { error } = await supabase.auth.resend({ type: "signup", email: email.trim(), options: { emailRedirectTo: authReturnUrl("confirm", window.location.href) } });
    if (error) throw error;
  }
  async function requestPasswordReset(email: string) {
    if (!supabase) throw new Error("Account sign-in is not available yet.");
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: authReturnUrl("recovery", window.location.href) });
    if (error) throw error;
  }
  function dismissRecovery() {
    setRecovery("none"); setAuthError(""); rememberRecovery(null);
    const url = new URL(window.location.href);
    url.searchParams.delete("account");
    if (readCallbackFragment(url)) url.hash = "";
    window.history.replaceState(window.history.state, "", url.href);
  }
  async function updatePassword(password: string, confirmation: string) {
    if (!supabase || !userId || owner.current !== userId || recovery !== "ready") throw new Error("Please open a valid password reset link first.");
    validatePassword(password, confirmation);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw error;
    if (owner.current !== userId) throw new Error("Your account changed. Please sign in again.");
    dismissRecovery();
  }
  async function updateProfile(name: string) {
    if (!supabase || !userId || owner.current !== userId) throw new Error("Please sign in first.");
    const profile = await saveProfile(supabase, userId, name);
    if (owner.current !== userId) throw new Error("Your account changed. Please sign in again.");
    setData(previous => ({ owner: userId, profile, saved: previous?.owner === userId ? previous.saved : [] }));
    await refresh();
  }
  async function save(composition: Composition) {
    if (!supabase || !userId || owner.current !== userId) throw new Error("Please sign in to save your composition.");
    if (data?.owner === userId && !canSaveComposition(data.saved, composition.id)) throw new Error("You can save up to eight compositions. Delete one before saving another.");
    const saved = await saveComposition(supabase, userId, composition);
    if (owner.current !== userId) throw new Error("Your account changed. Please sign in and save again.");
    setData(previous => ({ owner: userId, profile: previous?.owner === userId ? previous.profile : { id: userId, display_name: "" },
      saved: [saved, ...(previous?.owner === userId ? previous.saved.filter(item => item.id !== saved.id) : [])] }));
    await refresh();
  }
  async function remove(id: string) {
    if (!supabase || !userId || owner.current !== userId) throw new Error("Please sign in to delete a composition.");
    await deleteComposition(supabase, userId, id);
    if (owner.current !== userId) throw new Error("Your account changed. Please sign in again.");
    setData(previous => previous?.owner === userId ? { ...previous, saved: previous.saved.filter(item => item.id !== id) } : previous);
    await refresh();
  }
  async function signOut() {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut({ scope: "local" });
    if (error) throw error;
  }

  return { configured: !!supabase, user, authLoading, dataLoading, error, authError, recovery, refresh,
    profile: data && data.owner === userId ? data.profile : null, saved: data && data.owner === userId ? data.saved : [],
    signIn, signUp, resendConfirmation, requestPasswordReset, updatePassword, dismissRecovery, updateProfile, save, remove, signOut };
}

function recoveryOwner() {
  try { return window.sessionStorage.getItem("nuance:password-recovery"); } catch { return null; }
}

function rememberRecovery(owner: string | null) {
  try {
    if (owner) window.sessionStorage.setItem("nuance:password-recovery", owner);
    else window.sessionStorage.removeItem("nuance:password-recovery");
  } catch { /* A blocked session store only affects reset-form restoration. */ }
}

function readCallbackFragment(url: URL) {
  const fragment = new URLSearchParams(url.hash.slice(1));
  return fragment.has("access_token") || fragment.has("error") || fragment.has("error_code") || fragment.has("type");
}

export type Account = ReturnType<typeof useAccount>;
