import { Button } from "./Button";
import { Icon } from "./Icon";

export function AppHeader({ theme, displayName, email, avatarUrl, signedIn, loading, onHome, onAccount, onTheme }: {
  theme: "light" | "dark"; displayName: string; email?: string; avatarUrl?: string; signedIn: boolean; loading: boolean;
  onHome: () => void; onAccount: () => void; onTheme: () => void;
}) {
  return <header className="nuance-header">
    <a className="nuance-wordmark" href="#" aria-label="Nuance — home" onClick={event => { event.preventDefault(); onHome(); }}>
      <img src={`/nuance/assets/nuance-logo__${theme === "dark" ? "light" : "dark"}.svg`} alt="" width={350} height={81} />
    </a>
    <div className="nuance-header__actions">
      {signedIn ? <button type="button" className="nuance-button nuance-button--ghost nuance-button--sm account-button account-button--avatar"
        disabled={loading} aria-label={`Open account for ${displayName || email || "you"}`} aria-haspopup="dialog" onClick={onAccount}>
        {avatarUrl ? <img src={avatarUrl} alt="" /> : (email?.[0] || "N").toUpperCase()}
      </button> : <Button className="account-button" disabled={loading}
        aria-label={loading ? "Restoring your session..." : "Log in"} aria-haspopup="dialog" onClick={onAccount}>
        {loading ? "Restoring your session..." : "Log in"}
      </Button>}
      <Button onClick={onTheme} aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`} leadingIcon={<Icon name="moon" />}>
        {theme === "dark" ? "Dark" : "Light"}
      </Button>
    </div>
  </header>;
}
