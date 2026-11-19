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
  const [firstName, setFirstName] = useState(account.firstName);
  const [lastName, setLastName] = useState(account.lastName);
  const fileInput = useRef<HTMLInputElement>(null);
  const [operation, setOperation] = useState("");
  const [sent, setSent] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [signInFailed, setSignInFailed] = useState(false);
  const [message, setMessage] = useState("");
  const signup = mode === "signup";
  const forgot = mode === "forgot";
  const recovering = account.recovery !== "none";
  const coolingDown = (signup || forgot) && resendIn > 0;
  const title = recovering ? "Reset password" : account.user ? "Your account" : sent ? "Check your email" : forgot ? "Forgot password?" : signup ? "Create an account" : "Log in";
  const initials = (account.user?.email?.[0] || "N").toUpperCase();

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
    const field = mode === "signup" ? "first-name" : "email";
    dialog.current?.querySelector<HTMLInputElement>(`[id="${prefix}-${field}"]`)?.focus();
  }, [mode, sent, account.user?.id, account.recovery, prefix]);
  useEffect(() => {
    if (account.user) { setFirstName(account.firstName); setLastName(account.lastName); }
  }, [account.user?.id, account.firstName, account.lastName]);
  useEffect(() => {
    setError(""); setMessage(""); setSignInFailed(false); setSent(false); setPassword(""); setConfirmation(""); setMode("signin");
  }, [account.user?.id]);
  useEffect(() => {
    if (!resendIn) return;
    const timeout = window.setTimeout(() => setResendIn(value => Math.max(0, value - 1)), 1000);
    return () => window.clearTimeout(timeout);
  }, [resendIn]);

  async function run(action: () => Promise<void>, kind = "auth") {
    if (busy) return;
    setOperation(kind); setBusy(true); setError(""); setMessage("");
    try { await action(); } catch (error) { setError(accountError(error)); } finally { setBusy(false); }
  }
  function submitAuth(event: FormEvent) {
    event.preventDefault();
    void run(async () => {
      if (forgot) {
        await account.requestPasswordReset(email);
        setSent(true); setResendIn(60);
      } else if (signup) {
        validatePassword(password, password);
        setEmail(email.trim()); setFirstName(firstName.trim()); setLastName(lastName.trim());
        if (await account.signUp(email, password, firstName, lastName)) { setSent(true); setResendIn(60); }
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
    void run(async () => { await account.updateNames(firstName, lastName); setMessage("Name saved."); }, "name");
  }

  return <dialog ref={dialog} className={`account-dialog${account.user && !recovering ? " account-dialog--profile" : ""}`} aria-labelledby={`${prefix}-title`} onCancel={event => { event.preventDefault(); onClose(); }}>
    <div className="account-dialog__heading">
      <div className="account-dialog__greeting">
        <h2 id={`${prefix}-title`}>{title}</h2>
      </div>
      <Button className="account-dialog__close" aria-label="Close account" onClick={onClose}><X size={20} aria-hidden="true" /></Button>
    </div>
    {!account.configured ? <p>Account sign-in is being set up. You can keep exploring colors.</p>
      : account.authLoading ? <p role="status">Restoring your session...</p>
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
            <p role="status">{forgot ? `If an account exists for ${email}, you’ll receive a password reset link.` : "Check your email to confirm your account, then log in."}</p>
            <div className="account-dialog__actions">
              <Button disabled={busy || resendIn > 0} onClick={() => { void run(async () => {
                if (forgot) await sendResetLink();
                else { await account.resendConfirmation(email); setResendIn(60); setMessage("Confirmation email requested. Check your inbox."); }
              }); }}>
                {resendIn > 0 ? `Resend in ${resendIn}s` : "Resend email"}
              </Button>
              <Button disabled={busy} onClick={() => switchMode("signin")}>Back to log in</Button>
            </div>
        </div> : <form className="account-dialog__form" aria-busy={busy} onSubmit={submitAuth}>
            <p className="account-dialog__description">{forgot ? "Enter your email and we’ll send you a password reset link." : "Save your color compositions and typefaces to revisit them anytime."}</p>
            {signup && <>
              <label htmlFor={`${prefix}-first-name`}>First name (optional)</label>
              <input id={`${prefix}-first-name`} autoComplete="given-name" maxLength={80} value={firstName} disabled={busy} onChange={event => setFirstName(event.target.value)} />
              <label htmlFor={`${prefix}-last-name`}>Last name (optional)</label>
              <input id={`${prefix}-last-name`} autoComplete="family-name" maxLength={80} value={lastName} disabled={busy} onChange={event => setLastName(event.target.value)} />
            </>}
            <label htmlFor={`${prefix}-email`}>Email</label>
            <input key="email" id={`${prefix}-email`} type="email" autoFocus autoComplete="email" required value={email} disabled={busy} onChange={event => { setEmail(event.target.value); setSignInFailed(false); }} />
            {!forgot && <PasswordField label="Password" value={password} onChange={setPassword} disabled={busy} creating={signup} />}
            {signup && <>
              <p className="account-dialog__hint">Use at least {MIN_PASSWORD_LENGTH} characters.</p>
            </>}
            {!signup && !forgot && signInFailed && <Button className="account-dialog__text-action" disabled={busy} onClick={() => switchMode("forgot")}>Forgot password?</Button>}
            <Button type="submit" variant="primary" aria-live="polite" disabled={busy || coolingDown}>
              {busy ? "Please wait..." : coolingDown ? `Try again in ${resendIn}s` : forgot ? "Send reset link" : signup ? "Sign up" : "Log in"}
            </Button>
        </form>}
        {!sent && <div className="account-dialog__switch">
          <Button disabled={busy} onClick={() => switchMode(forgot || signup ? "signin" : "signup")}>{forgot ? "Back to log in" : signup ? "Already have an account? Log in" : "Create an account"}</Button>
        </div>}
      </> : <>
        <section className="account-profile" aria-label="Profile">
          <p className="account-profile__email">{account.user.email}</p>
          <form className="account-dialog__form" onSubmit={submitProfile} aria-busy={busy && operation === "name"}>
            <label htmlFor={`${prefix}-first-name`}>First name (optional)</label>
            <input id={`${prefix}-first-name`} autoComplete="given-name" maxLength={80} value={firstName} disabled={busy} onChange={event => setFirstName(event.target.value)} />
            <label htmlFor={`${prefix}-last-name`}>Last name (optional)</label>
            <input id={`${prefix}-last-name`} autoComplete="family-name" maxLength={80} value={lastName} disabled={busy} onChange={event => setLastName(event.target.value)} />
            <Button className="account-profile__action" type="submit" aria-live="polite" disabled={busy}>{busy && operation === "name" ? "Saving name..." : "Save name"}</Button>
          </form>
          <div className="account-profile__image-row">
            <span className="account-dialog__avatar" aria-hidden="true">
              {account.avatar.url ? <img src={account.avatar.url} alt="" onError={() => { void account.avatar.reload(); }} /> : initials}
            </span>
            <input ref={fileInput} className="account-profile__file" type="file" accept="image/jpeg,image/png,image/webp" aria-label="Choose avatar" disabled={busy || account.avatar.loading} onChange={event => {
              const file = event.currentTarget.files?.[0];
              event.currentTarget.value = "";
              if (file) void run(async () => { await account.avatar.upload(file); setMessage("Avatar saved."); }, "avatar");
            }} />
            <Button disabled={busy || account.avatar.loading} onClick={() => fileInput.current?.click()}>{busy && operation === "avatar" ? "Uploading..." : account.avatar.url ? "Change avatar" : "Upload avatar"}</Button>
          </div>
          <p className="account-dialog__hint">JPEG, PNG, or WebP · up to 2 MB.<br />Uploads save automatically.</p>
          {account.avatar.loading && <p role="status">Loading avatar...</p>}
          {account.avatar.error && <div><p role="alert">Could not load your avatar. {account.avatar.error}</p><Button disabled={busy} onClick={() => { void account.avatar.reload(); }}>Retry avatar</Button></div>}
          {account.avatar.url && <Button className="account-profile__action" disabled={busy} onClick={() => { void run(async () => { await account.avatar.remove(); setMessage("Avatar removed."); }, "remove"); }}>{busy && operation === "remove" ? "Removing..." : "Remove avatar"}</Button>}
          {error && <p role="alert">{error}</p>}
          {message && <p role="status">{message}</p>}
          <Button className="account-profile__action" disabled={busy} leadingIcon={<LogOut size={18} aria-hidden="true" />} onClick={() => { void run(account.signOut, "logout"); }}>{busy && operation === "logout" ? "Please wait..." : "Log out"}</Button>
          <details className="account-profile__security"><summary>Password options</summary>
            <Button disabled={busy || resendIn > 0} onClick={() => { void run(() => sendResetLink(account.user?.email || "")); }}>{resendIn > 0 ? `Send again in ${resendIn}s` : "Reset password"}</Button>
          </details>
        </section>
        {account.error && <div className="account-dialog__form"><p role="alert">{account.error}</p><Button disabled={busy} onClick={() => { void account.refresh(); }}>Try again</Button></div>}
      </>}
    {(!account.user || recovering) && error && <p role="alert">{error}</p>}
    {account.authError && account.authError !== error && <p role="alert">{account.authError}</p>}
    {(!account.user || recovering) && message && <p role="status">{message}</p>}
  </dialog>;
}
