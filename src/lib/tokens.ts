export type LayoutPreset = "sidebar" | "topnav" | "centered" | "split";
export type DensityPreset = "compact" | "cosy";
export type RadiusPreset = "none" | "sm" | "md" | "lg";
export type ShadowPreset = "none" | "subtle" | "elevated";
export type BorderPreset = "on" | "off";
export type ThemePreset = "light" | "dark";
export type AccentPreset = "sky" | "emerald" | "rose" | "amber" | "violet" | "teal";
export type EditableColorToken =
  | "background"
  | "surface"
  | "panel"
  | "border"
  | "foreground"
  | "muted"
  | "mutedForeground"
  | "primary"
  | "primaryForeground"
  | "badge";

export type ColorOverrides = {
  light: Partial<Record<EditableColorToken, string>>;
  dark: Partial<Record<EditableColorToken, string>>;
};

export type TokenState = {
  layout: LayoutPreset;
  density: DensityPreset;
  radius: RadiusPreset;
  shadow: ShadowPreset;
  borders: BorderPreset;
  theme: ThemePreset;
  accent: AccentPreset;
  colorOverrides: ColorOverrides;
};

export const defaultTokenState: TokenState = {
  layout: "sidebar",
  density: "cosy",
  radius: "md",
  shadow: "subtle",
  borders: "on",
  theme: "light",
  accent: "sky",
  colorOverrides: {
    light: {},
    dark: {},
  },
};

type PaletteMode = {
  primary: string;
  primaryForeground: string;
  background: string;
  surface: string;
  panel: string;
  border: string;
  foreground: string;
  muted: string;
  mutedForeground: string;
  badge: string;
  ring: string;
};

type AccentPalette = {
  light: Pick<PaletteMode, "primary" | "primaryForeground" | "badge" | "ring">;
  dark: Pick<PaletteMode, "primary" | "primaryForeground" | "badge" | "ring">;
};

export const accentOptions: Array<{ key: AccentPreset; label: string; swatch: string }> = [
  { key: "sky", label: "Sky", swatch: "#0EA5E9" },
  { key: "emerald", label: "Emerald", swatch: "#10B981" },
  { key: "rose", label: "Rose", swatch: "#F43F5E" },
  { key: "amber", label: "Amber", swatch: "#F59E0B" },
  { key: "violet", label: "Violet", swatch: "#8B5CF6" },
  { key: "teal", label: "Teal", swatch: "#14B8A6" },
];

const accentPalettes: Record<AccentPreset, AccentPalette> = {
  sky: {
    light: {
      primary: "#0284C7",
      primaryForeground: "#F8FAFC",
      badge: "#E0F2FE",
      ring: "rgba(2, 132, 199, 0.28)",
    },
    dark: {
      primary: "#38BDF8",
      primaryForeground: "#082F49",
      badge: "rgba(56, 189, 248, 0.18)",
      ring: "rgba(56, 189, 248, 0.28)",
    },
  },
  emerald: {
    light: {
      primary: "#059669",
      primaryForeground: "#ECFDF5",
      badge: "#D1FAE5",
      ring: "rgba(5, 150, 105, 0.28)",
    },
    dark: {
      primary: "#34D399",
      primaryForeground: "#022C22",
      badge: "rgba(52, 211, 153, 0.18)",
      ring: "rgba(52, 211, 153, 0.28)",
    },
  },
  rose: {
    light: {
      primary: "#E11D48",
      primaryForeground: "#FFF1F2",
      badge: "#FFE4E6",
      ring: "rgba(225, 29, 72, 0.24)",
    },
    dark: {
      primary: "#FB7185",
      primaryForeground: "#4C0519",
      badge: "rgba(251, 113, 133, 0.16)",
      ring: "rgba(251, 113, 133, 0.28)",
    },
  },
  amber: {
    light: {
      primary: "#D97706",
      primaryForeground: "#FFFBEB",
      badge: "#FEF3C7",
      ring: "rgba(217, 119, 6, 0.22)",
    },
    dark: {
      primary: "#FBBF24",
      primaryForeground: "#451A03",
      badge: "rgba(251, 191, 36, 0.16)",
      ring: "rgba(251, 191, 36, 0.24)",
    },
  },
  violet: {
    light: {
      primary: "#7C3AED",
      primaryForeground: "#F5F3FF",
      badge: "#EDE9FE",
      ring: "rgba(124, 58, 237, 0.24)",
    },
    dark: {
      primary: "#A78BFA",
      primaryForeground: "#2E1065",
      badge: "rgba(167, 139, 250, 0.18)",
      ring: "rgba(167, 139, 250, 0.28)",
    },
  },
  teal: {
    light: {
      primary: "#0F766E",
      primaryForeground: "#F0FDFA",
      badge: "#CCFBF1",
      ring: "rgba(15, 118, 110, 0.24)",
    },
    dark: {
      primary: "#2DD4BF",
      primaryForeground: "#042F2E",
      badge: "rgba(45, 212, 191, 0.18)",
      ring: "rgba(45, 212, 191, 0.28)",
    },
  },
};

const baseLight: Omit<PaletteMode, "primary" | "primaryForeground" | "badge" | "ring"> = {
  background: "#F5F7FB",
  surface: "#FFFFFF",
  panel: "#F8FAFC",
  border: "#E2E8F0",
  foreground: "#0F172A",
  muted: "#F1F5F9",
  mutedForeground: "#475569",
};

const baseDark: Omit<PaletteMode, "primary" | "primaryForeground" | "badge" | "ring"> = {
  background: "#090C12",
  surface: "#111827",
  panel: "#0F172A",
  border: "#273449",
  foreground: "#E5E7EB",
  muted: "#1F2937",
  mutedForeground: "#94A3B8",
};

const radiusScale: Record<RadiusPreset, { token: string; sm: string }> = {
  none: { token: "0rem", sm: "0rem" },
  sm: { token: "0.5rem", sm: "0.375rem" },
  md: { token: "0.875rem", sm: "0.625rem" },
  lg: { token: "1.125rem", sm: "0.875rem" },
};

const shadowScale: Record<ShadowPreset, { card: string; pop: string }> = {
  none: {
    card: "none",
    pop: "none",
  },
  subtle: {
    card: "0 1px 2px rgba(15, 23, 42, 0.08), 0 6px 16px rgba(15, 23, 42, 0.08)",
    pop: "0 1px 3px rgba(15, 23, 42, 0.10), 0 10px 20px rgba(15, 23, 42, 0.10)",
  },
  elevated: {
    card: "0 2px 6px rgba(15, 23, 42, 0.12), 0 14px 30px rgba(15, 23, 42, 0.14)",
    pop: "0 4px 10px rgba(15, 23, 42, 0.14), 0 18px 36px rgba(15, 23, 42, 0.18)",
  },
};

const densityScale: Record<DensityPreset, { panelGap: number; cardPad: number; inputPadY: number }> = {
  compact: { panelGap: 12, cardPad: 12, inputPadY: 8 },
  cosy: { panelGap: 16, cardPad: 16, inputPadY: 10 },
};

const borderWidthScale: Record<BorderPreset, string> = {
  on: "1px",
  off: "0px",
};

type ThemeVars = Record<string, string>;

const colorVarNameByToken: Record<EditableColorToken, keyof ThemeVars> = {
  background: "--color-background",
  surface: "--color-surface",
  panel: "--color-panel",
  border: "--color-border",
  foreground: "--color-foreground",
  muted: "--color-muted",
  mutedForeground: "--color-muted-foreground",
  primary: "--color-primary",
  primaryForeground: "--color-primary-foreground",
  badge: "--color-badge",
};

const ringAlphaByTheme: Record<ThemePreset, number> = {
  light: 0.28,
  dark: 0.28,
};

const hexToRgba = (hex: string, alpha: number) => {
  const normalized = hex.replace("#", "").trim();
  const full = normalized.length === 3 ? normalized.split("").map((c) => `${c}${c}`).join("") : normalized;

  if (!/^[0-9a-fA-F]{6}$/.test(full)) {
    return undefined;
  }

  const r = Number.parseInt(full.slice(0, 2), 16);
  const g = Number.parseInt(full.slice(2, 4), 16);
  const b = Number.parseInt(full.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const applyColorOverrides = (mode: ThemePreset, vars: ThemeVars, overrides: Partial<Record<EditableColorToken, string>>) => {
  const next = { ...vars };

  for (const [tokenKey, value] of Object.entries(overrides) as Array<[EditableColorToken, string]>) {
    if (!value) continue;
    next[colorVarNameByToken[tokenKey]] = value;
  }

  if (overrides.primary) {
    const ring = hexToRgba(overrides.primary, ringAlphaByTheme[mode]);
    if (ring) {
      next["--color-ring"] = ring;
    }
  }

  return next;
};

const toCssBlock = (selector: string, vars: ThemeVars) => {
  const lines = Object.entries(vars).map(([name, value]) => `  ${name}: ${value};`);
  return `${selector} {\n${lines.join("\n")}\n}`;
};

export const buildThemeVars = (tokens: TokenState) => {
  const accent = accentPalettes[tokens.accent];
  const radius = radiusScale[tokens.radius];
  const shadow = shadowScale[tokens.shadow];
  const density = densityScale[tokens.density];
  const borderWidth = borderWidthScale[tokens.borders];

  const lightVars: ThemeVars = {
    "--color-background": baseLight.background,
    "--color-surface": baseLight.surface,
    "--color-panel": baseLight.panel,
    "--color-border": baseLight.border,
    "--color-foreground": baseLight.foreground,
    "--color-muted": baseLight.muted,
    "--color-muted-foreground": baseLight.mutedForeground,
    "--color-primary": accent.light.primary,
    "--color-primary-foreground": accent.light.primaryForeground,
    "--color-badge": accent.light.badge,
    "--color-ring": accent.light.ring,
    "--border-width-token": borderWidth,
    "--radius-token": radius.token,
    "--radius-token-sm": radius.sm,
    "--shadow-card": shadow.card,
    "--shadow-pop": shadow.pop,
    "--space-panel-gap": `${density.panelGap}px`,
    "--space-card-pad": `${density.cardPad}px`,
    "--space-input-py": `${density.inputPadY}px`,
  };

  const darkVars: ThemeVars = {
    "--color-background": baseDark.background,
    "--color-surface": baseDark.surface,
    "--color-panel": baseDark.panel,
    "--color-border": baseDark.border,
    "--color-foreground": baseDark.foreground,
    "--color-muted": baseDark.muted,
    "--color-muted-foreground": baseDark.mutedForeground,
    "--color-primary": accent.dark.primary,
    "--color-primary-foreground": accent.dark.primaryForeground,
    "--color-badge": accent.dark.badge,
    "--color-ring": accent.dark.ring,
    "--border-width-token": borderWidth,
    "--radius-token": radius.token,
    "--radius-token-sm": radius.sm,
    "--shadow-card": shadow.card,
    "--shadow-pop": shadow.pop,
    "--space-panel-gap": `${density.panelGap}px`,
    "--space-card-pad": `${density.cardPad}px`,
    "--space-input-py": `${density.inputPadY}px`,
  };

  const lightWithOverrides = applyColorOverrides("light", lightVars, tokens.colorOverrides.light);
  const darkWithOverrides = applyColorOverrides("dark", darkVars, tokens.colorOverrides.dark);

  // In dark mode, elevated surfaces benefit from a tiny neutral highlight/glow
  // so depth reads without making the whole UI look neon.
  if (tokens.shadow === "elevated") {
    darkWithOverrides["--shadow-card"] = `${darkWithOverrides["--shadow-card"]}, 0 0 0 1px rgba(255,255,255,0.03), 0 0 28px rgba(148, 163, 184, 0.05)`;
    darkWithOverrides["--shadow-pop"] = `${darkWithOverrides["--shadow-pop"]}, 0 0 0 1px rgba(255,255,255,0.04), 0 0 36px rgba(148, 163, 184, 0.06)`;
  }

  return {
    lightVars: lightWithOverrides,
    darkVars: darkWithOverrides,
  };
};

export const getActiveThemeStyleVars = (tokens: TokenState): Record<string, string> => {
  const { lightVars, darkVars } = buildThemeVars(tokens);
  return tokens.theme === "dark" ? darkVars : lightVars;
};

export const buildCssVariablesString = (tokens: TokenState) => {
  const { lightVars, darkVars } = buildThemeVars(tokens);

  return [
    "/* PatternSmith tokens: paste into your app CSS (e.g. src/styles/tokens.css) */",
    toCssBlock(":root", lightVars),
    "",
    toCssBlock(".dark", darkVars),
  ].join("\n");
};

export const buildTailwindConfigString = () => {
  return `// PatternSmith theme extension snippet\nexport default {\n  theme: {\n    extend: {\n      colors: {\n        background: "var(--color-background)",\n        surface: "var(--color-surface)",\n        panel: "var(--color-panel)",\n        border: "var(--color-border)",\n        foreground: "var(--color-foreground)",\n        muted: "var(--color-muted)",\n        "muted-foreground": "var(--color-muted-foreground)",\n        primary: "var(--color-primary)",\n        "primary-foreground": "var(--color-primary-foreground)",\n        badge: "var(--color-badge)",\n        ring: "var(--color-ring)",\n      },\n      borderWidth: {\n        token: "var(--border-width-token)",\n      },\n      borderRadius: {\n        token: "var(--radius-token)",\n        "token-sm": "var(--radius-token-sm)",\n      },\n      boxShadow: {\n        card: "var(--shadow-card)",\n        pop: "var(--shadow-pop)",\n      },\n      spacing: {\n        "panel-gap": "var(--space-panel-gap)",\n        "card-pad": "var(--space-card-pad)",\n        "input-py": "var(--space-input-py)",\n      },\n    },\n  },\n};`;
};

const buttonComponentString = `import type { ButtonHTMLAttributes } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost";
};

export function Button({ variant = "primary", className = "", ...props }: ButtonProps) {
  const base =
    "inline-flex items-center justify-center rounded-token px-4 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--color-ring)]";

  const variants = {
    primary: "bg-primary text-primary-foreground shadow-card hover:brightness-95",
    ghost: "bg-surface text-foreground border-token border-border hover:bg-muted",
  } as const;

  return <button className={\`\${base} \${variants[variant]} \${className}\`.trim()} {...props} />;
}
`;

const cardComponentString = `import type { PropsWithChildren } from "react";

type CardProps = PropsWithChildren<{
  title?: string;
  subtitle?: string;
  className?: string;
}>;

export function Card({ title, subtitle, className = "", children }: CardProps) {
  return (
    <section className={\`rounded-token border-token border-border bg-surface p-card-pad shadow-card \${className}\`.trim()}>
      {(title || subtitle) && (
        <header className="mb-3">
          {title ? <h3 className="text-sm font-semibold text-foreground">{title}</h3> : null}
          {subtitle ? <p className="text-xs text-muted-foreground">{subtitle}</p> : null}
        </header>
      )}
      {children}
    </section>
  );
}
`;

const inputComponentString = `import type { InputHTMLAttributes } from "react";

type InputProps = InputHTMLAttributes<HTMLInputElement>;

export function Input({ className = "", ...props }: InputProps) {
  return (
    <input
      className={\`w-full rounded-token-sm border-token border-border bg-surface px-3 py-input-py text-sm text-foreground placeholder:text-muted-foreground shadow-card focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--color-ring)] \${className}\`.trim()}
      {...props}
    />
  );
}
`;

const badgeComponentString = `import type { PropsWithChildren } from "react";

type BadgeProps = PropsWithChildren<{
  tone?: "accent" | "neutral";
  className?: string;
}>;

export function Badge({ tone = "accent", className = "", children }: BadgeProps) {
  const tones = {
    accent: "bg-badge text-foreground",
    neutral: "bg-muted text-muted-foreground",
  } as const;

  return (
    <span
      className={\`inline-flex items-center rounded-token-sm border-token border-border px-2.5 py-1 text-xs font-medium \${tones[tone]} \${className}\`.trim()}
    >
      {children}
    </span>
  );
}
`;

export const buildComponentExports = () => {
  const files = {
    "components/Button.tsx": buttonComponentString,
    "components/Card.tsx": cardComponentString,
    "components/Input.tsx": inputComponentString,
    "components/Badge.tsx": badgeComponentString,
  } as const;

  const bundle = Object.entries(files)
    .map(([file, content]) => `// ${file}\n${content.trimEnd()}`)
    .join("\n\n");

  return { files, bundle };
};

export const buildExportArtifacts = (tokens: TokenState) => {
  const components = buildComponentExports();

  return {
    cssVariables: buildCssVariablesString(tokens),
    tailwindConfig: buildTailwindConfigString(),
    componentsBundle: components.bundle,
    componentFiles: components.files,
  };
};

export const editableColorOptions: Array<{ key: EditableColorToken; label: string; description: string }> = [
  { key: "background", label: "Background", description: "App shell background" },
  { key: "surface", label: "Surface", description: "Cards and panels" },
  { key: "panel", label: "Panel", description: "Secondary panel backgrounds" },
  { key: "border", label: "Border", description: "Outlines and dividers" },
  { key: "foreground", label: "Foreground", description: "Primary text color" },
  { key: "muted", label: "Muted", description: "Subtle fills" },
  { key: "mutedForeground", label: "Muted Text", description: "Secondary text color" },
  { key: "primary", label: "Primary", description: "Accent button / highlights" },
  { key: "primaryForeground", label: "Primary Text", description: "Text on primary surfaces" },
  { key: "badge", label: "Badge", description: "Badge fill color" },
];

export const getEditableColorValues = (
  tokens: TokenState,
  theme: ThemePreset,
): Record<EditableColorToken, string> => {
  const { lightVars, darkVars } = buildThemeVars(tokens);
  const vars = theme === "dark" ? darkVars : lightVars;

  return {
    background: vars["--color-background"],
    surface: vars["--color-surface"],
    panel: vars["--color-panel"],
    border: vars["--color-border"],
    foreground: vars["--color-foreground"],
    muted: vars["--color-muted"],
    mutedForeground: vars["--color-muted-foreground"],
    primary: vars["--color-primary"],
    primaryForeground: vars["--color-primary-foreground"],
    badge: vars["--color-badge"],
  };
};

export const tokenOptionLabels = {
  layout: [
    { value: "sidebar", label: "Sidebar" },
    { value: "topnav", label: "Topnav" },
    { value: "centered", label: "Centered" },
    { value: "split", label: "Split" },
  ] as Array<{ value: LayoutPreset; label: string }>,
  density: [
    { value: "compact", label: "Compact" },
    { value: "cosy", label: "Cosy" },
  ] as Array<{ value: DensityPreset; label: string }>,
  radius: [
    { value: "none", label: "None" },
    { value: "sm", label: "Small" },
    { value: "md", label: "Medium" },
    { value: "lg", label: "Large" },
  ] as Array<{ value: RadiusPreset; label: string }>,
  shadow: [
    { value: "none", label: "None" },
    { value: "subtle", label: "Subtle" },
    { value: "elevated", label: "Elevated" },
  ] as Array<{ value: ShadowPreset; label: string }>,
  borders: [
    { value: "on", label: "On" },
    { value: "off", label: "Off" },
  ] as Array<{ value: BorderPreset; label: string }>,
  theme: [
    { value: "light", label: "Light" },
    { value: "dark", label: "Dark" },
  ] as Array<{ value: ThemePreset; label: string }>,
};

export const formatTokenSummary = (tokens: TokenState) =>
  [
    `layout:${tokens.layout}`,
    `density:${tokens.density}`,
    `radius:${tokens.radius}`,
    `shadow:${tokens.shadow}`,
    `borders:${tokens.borders}`,
    `theme:${tokens.theme}`,
    `accent:${tokens.accent}`,
  ].join(" • ");

export const cssVarPreviewStyle = (tokens: TokenState): Record<string, string> => {
  return getActiveThemeStyleVars(tokens);
};
