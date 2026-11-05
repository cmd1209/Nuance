import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { LogOut, X } from "lucide-react";
import { accountError, type Account } from "../account/useAccount";
import { MIN_PASSWORD_LENGTH, validatePassword, type EmailAuthMode } from "../account/emailAuth";
import { Button } from "./Button";
import { PasswordField } from "./PasswordField";

export function AccountDialog({ account, onClose }: { account: Account; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const prefix = useId();
  const [mode, setMode] = useState<EmailAuthMode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [signupName, setSignupName] = useState("");
  const [sent, setSent] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const [name, setName] = useState(account.profile?.display_name ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [signInFailed, setSignInFailed] = useState(false);
  const [message, setMessage] = useState("");
  const signup = mode === "signup";
  const forgot = mode === "forgot";
  const recovering = account.recovery !== "none";
  const coolingDown = (signup || forgot) && resendIn > 0;
  const title = recovering ? "Reset password" : account.user ? `Hi, ${account.profile?.display_name.trim() || "there"}` : sent ? "Check your email" : forgot ? "Forgot password?" : signup ? "Create account" : "Sign in";
  const displayName = account.profile?.display_name || "Your account";
  const initials = (account.profile?.display_name || account.user?.email || "N").trim().split(/\s+/).slice(0, 2).map(part => part[0]).join("").toUpperCase();

  useEffect(() => {
    const element = dialog.current!;
    const previous = document.activeElement as HTMLElement | null;
    element.showModal();
    return () => {
      element.close();
      if (previous?.isConnected) previous.focus();
    };
  }, []);
  useEffect(() => {
    if (account.recovery === "ready") {
      dialog.current?.querySelector<HTMLInputElement>('input[autocomplete="new-password"]')?.focus();
      return;
    }
    if (account.user) return;
    const field = mode === "signup" ? "signup-name" : "email";
    dialog.current?.querySelector<HTMLInputElement>(`[id="${prefix}-${field}"]`)?.focus();
  }, [mode, sent, account.user?.id, account.recovery, prefix]);
  useEffect(() => { setName(account.profile?.display_name ?? ""); }, [account.profile?.id, account.profile?.display_name]);
  useEffect(() => {
    setError(""); setMessage(""); setSignInFailed(false); setSent(false); setPassword(""); setConfirmation(""); setMode("signin");
  }, [account.user?.id]);
  useEffect(() => {
    if (!resendIn) return;
    const timeout = window.setTimeout(() => setResendIn(value => Math.max(0, value - 1)), 1000);
    return () => window.clearTimeout(timeout);
  }, [resendIn]);

  async function run(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true); setError(""); setMessage("");
    try { await action(); } catch (error) { setError(accountError(error)); } finally { setBusy(false); }
  }
  function submitAuth(event: FormEvent) {
    event.preventDefault();
    void run(async () => {
      if (forgot) {
        await account.requestPasswordReset(email);
        setSent(true); setResendIn(60);
      } else if (signup) {
        validatePassword(password, confirmation);
        if (await account.signUp(email, password, signupName)) { setSent(true); setResendIn(60); }
      } else {
        try { await account.signIn(email, password); setSignInFailed(false); }
        catch (error) { setSignInFailed(true); throw error; }
      }
      setPassword(""); setConfirmation("");
    });
  }
  function submitPassword(event: FormEvent) {
    event.preventDefault();
    void run(async () => {
      await account.updatePassword(password, confirmation);
      setPassword(""); setConfirmation(""); setMessage("Password updated.");
    });
  }
  async function sendResetLink(target = email || account.user?.email || "") {
    await account.requestPasswordReset(target);
    setResendIn(60);
    setMessage("If an account exists for that email, you’ll receive a password reset link.");
  }
  function switchMode(next: EmailAuthMode) {
    setMode(next); setSent(false); setPassword(""); setConfirmation(""); setError(""); setMessage(""); setSignInFailed(false);
  }
  function submitProfile(event: FormEvent) {
    event.preventDefault();
    void run(async () => { await account.updateProfile(name); setMessage("Profile updated."); });
  }

  return <dialog ref={dialog} className="account-dialog" aria-labelledby={`${prefix}-title`} onCancel={event => { event.preventDefault(); onClose(); }}>
    <div className="account-dialog__heading">
      <div className="account-dialog__greeting">
        <h2 id={`${prefix}-title`}>{title}</h2>
      </div>
      <Button className="account-dialog__close" aria-label="Close account" onClick={onClose}><X size={20} aria-hidden="true" /></Button>
    </div>
    {!account.configured ? <p>Account sign-in is being set up. You can keep exploring colors.</p>
      : account.authLoading ? <p role="status">Loading your account…</p>
      : recovering ? account.recovery === "pending" ? <p role="status">Checking your reset link…</p>
      : account.recovery === "expired" ? <form className="account-dialog__form" onSubmit={event => { event.preventDefault(); void run(sendResetLink); }}>
        <p role="alert">This reset link has expired or is invalid. Request a new link to continue.</p>
        <label htmlFor={`${prefix}-recovery-email`}>Email</label>
        <input id={`${prefix}-recovery-email`} type="email" autoComplete="email" required value={email || account.user?.email || ""} disabled={busy} onChange={event => setEmail(event.target.value)} />
        <Button type="submit" variant="primary" disabled={busy || resendIn > 0}>{busy ? "Sending…" : resendIn > 0 ? `Send again in ${resendIn}s` : "Send new reset link"}</Button>
      </form> : <form className="account-dialog__form" onSubmit={submitPassword}>
        <p className="account-dialog__description">Choose a new password for your Nuance account.</p>
        <PasswordField label="New password" value={password} onChange={setPassword} disabled={busy} creating />
        <PasswordField label="Confirm new password" value={confirmation} onChange={setConfirmation} disabled={busy} creating />
        <p className="account-dialog__hint">Use at least {MIN_PASSWORD_LENGTH} characters.</p>
        <Button type="submit" variant="primary" disabled={busy}>{busy ? "Updating…" : "Update password"}</Button>
      </form>
      : !account.user ? <>
        {sent ? <div className="account-dialog__form">
            <p role="status">{forgot ? `If an account exists for ${email}, you’ll receive a password reset link.` : `Check ${email} for a confirmation email. Follow the link to confirm your account, then sign in.`}</p>
            <div className="account-dialog__actions">
              <Button disabled={busy || resendIn > 0} onClick={() => { void run(async () => {
                if (forgot) await sendResetLink();
                else { await account.resendConfirmation(email); setResendIn(60); setMessage("Confirmation email requested. Check your inbox."); }
              }); }}>
                {resendIn > 0 ? `Resend in ${resendIn}s` : "Resend email"}
              </Button>
              <Button disabled={busy} onClick={() => switchMode("signin")}>Back to sign in</Button>
            </div>
        </div> : <form className="account-dialog__form" onSubmit={submitAuth}>
            <p className="account-dialog__description">{forgot ? "Enter your email and we’ll send you a password reset link." : signup ? "Create your Nuance account to save your compositions." : "Welcome back. Sign in to your Nuance account."}</p>
            {signup && <>
              <label htmlFor={`${prefix}-signup-name`}>Display name</label>
              <input id={`${prefix}-signup-name`} autoComplete="nickname" maxLength={80} required value={signupName} disabled={busy} onChange={event => setSignupName(event.target.value)} />
            </>}
            <label htmlFor={`${prefix}-email`}>Email</label>
            <input key="email" id={`${prefix}-email`} type="email" autoFocus autoComplete="email" required value={email} disabled={busy} onChange={event => { setEmail(event.target.value); setSignInFailed(false); }} />
            {!forgot && <PasswordField label="Password" value={password} onChange={setPassword} disabled={busy} creating={signup} />}
            {signup && <>
              <PasswordField label="Confirm password" value={confirmation} onChange={setConfirmation} disabled={busy} creating />
              <p className="account-dialog__hint">Use at least {MIN_PASSWORD_LENGTH} characters.</p>
            </>}
            {!signup && !forgot && signInFailed && <Button className="account-dialog__text-action" disabled={busy} onClick={() => switchMode("forgot")}>Forgot password?</Button>}
            <Button type="submit" variant="primary" disabled={busy || coolingDown}>
              {busy ? forgot ? "Sending…" : signup ? "Creating account…" : "Signing in…" : coolingDown ? `Try again in ${resendIn}s` : forgot ? "Send reset link" : signup ? "Create account" : "Sign in"}
            </Button>
        </form>}
        {!sent && <div className="account-dialog__switch">
          {!forgot && <span>{signup ? "Already have an account?" : "New to Nuance?"}</span>}
          <Button disabled={busy} onClick={() => switchMode(forgot || signup ? "signin" : "signup")}>{forgot ? "Back to sign in" : signup ? "Sign in" : "Create account"}</Button>
        </div>}
      </> : <>
        <section aria-label="Profile">
          <div className="account-dialog__identity">
            <span className="account-dialog__avatar" aria-hidden="true">{initials}</span>
            <div><p className="account-dialog__name">{displayName}</p><p className="account-dialog__hint">{account.user.email}</p></div>
          </div>
          <form className="account-dialog__form" onSubmit={submitProfile}>
            <label htmlFor={`${prefix}-name`}>Display name</label>
            <input id={`${prefix}-name`} autoComplete="nickname" maxLength={80} value={name} disabled={busy || account.dataLoading || !!account.error} onChange={event => setName(event.target.value)} />
            <label htmlFor={`${prefix}-profile-email`}>Email</label>
            <input id={`${prefix}-profile-email`} type="email" value={account.user.email ?? ""} readOnly />
            <div className="account-dialog__actions">
              <Button type="submit" variant="primary" disabled={busy || account.dataLoading || !!account.error}>{busy ? "Saving…" : "Save changes"}</Button>
              <Button onClick={onClose}>Cancel</Button>
            </div>
          </form>
          <div className="account-dialog__security">
            <h3>Password</h3>
            <p className="account-dialog__hint">Use a secure email link to set or reset your password.</p>
            <Button disabled={busy || resendIn > 0} onClick={() => { void run(() => sendResetLink(account.user?.email || "")); }}>{resendIn > 0 ? `Send again in ${resendIn}s` : "Reset password"}</Button>
          </div>
          <div className="account-dialog__footer">
            <Button disabled={busy} leadingIcon={<LogOut size={16} aria-hidden="true" />} onClick={() => { void run(account.signOut); }}>Sign out</Button>
          </div>
        </section>
        {account.error && <div className="account-dialog__form"><p role="alert">{account.error}</p><Button disabled={busy} onClick={() => { void account.refresh(); }}>Try again</Button></div>}
      </>}
    {error && <p role="alert">{error}</p>}
    {account.authError && <p role="alert">{account.authError}</p>}
    {message && <p role="status">{message}</p>}
  </dialog>;
}
