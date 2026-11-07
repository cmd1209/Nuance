import { Button } from "./Button";
import { Icon } from "./Icon";

export function AppHeader({ theme, displayName, signedIn, loading, onHome, onAccount, onTheme }: {
  theme: "light" | "dark"; displayName: string; signedIn: boolean; loading: boolean;
  onHome: () => void; onAccount: () => void; onTheme: () => void;
}) {
  return <header className="nuance-header">
    <a className="nuance-wordmark" href="#" aria-label="Nuance — home" onClick={event => { event.preventDefault(); onHome(); }}>
      <img src={`/nuance/assets/nuance-logo__${theme === "dark" ? "light" : "dark"}.svg`} alt="" width={350} height={81} />
    </a>
    <div className="nuance-header__actions">
      <Button className="account-button" disabled={loading} aria-label={signedIn ? "Open your profile" : "Sign in"}
        onClick={onAccount} leadingIcon={<Icon name="user" />}>
        <span className="account-button__name">{loading ? "Loading…" : signedIn ? displayName || "Account" : "Sign in"}</span>
      </Button>
      <Button onClick={onTheme} aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`} leadingIcon={<Icon name="moon" />}>
        {theme === "dark" ? "Dark" : "Light"}
      </Button>
    </div>
  </header>;
}
