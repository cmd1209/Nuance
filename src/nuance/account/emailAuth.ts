export type EmailAuthMode = "signin" | "signup" | "forgot";
export const MIN_PASSWORD_LENGTH = 12;

export function validatePassword(password: string, confirmation: string) {
  if (password.length < MIN_PASSWORD_LENGTH) throw new Error(`Use at least ${MIN_PASSWORD_LENGTH} characters for your password.`);
  if (password !== confirmation) throw new Error("The passwords do not match.");
}

export function authReturnUrl(kind: "confirm" | "recovery", href: string): string {
  const url = new URL(href);
  url.search = "";
  url.hash = "";
  url.searchParams.set("account", kind);
  return url.href;
}

export function readAuthReturn(href: string) {
  const url = new URL(href);
  const fragment = new URLSearchParams(url.hash.slice(1));
  const value = url.searchParams.get("account");
  const kind = value === "recovery" || fragment.get("type") === "recovery" ? "recovery" : value === "confirm" ? "confirm" : null;
  return { kind, hasError: fragment.has("error") || fragment.has("error_code") || url.searchParams.has("error") || url.searchParams.has("error_code") };
}
