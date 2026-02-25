import { useState, type CSSProperties } from "react";
import { ControlsPanel } from "./components/ControlsPanel";
import { ExportPanel } from "./components/ExportPanel";
import { PreviewPanel } from "./components/PreviewPanel";
import {
  buildExportArtifacts,
  defaultTokenState,
  type EditableColorToken,
  type ThemePreset,
  type TokenState,
} from "./lib/tokens";

type AppShellTheme = "light" | "dark";

const appShellVarsByTheme: Record<AppShellTheme, Record<string, string>> = {
  light: {
    "--color-background": "#F3F4F6",
    "--color-surface": "#FFFFFF",
    "--color-panel": "#F8FAFC",
    "--color-border": "#D1D5DB",
    "--color-foreground": "#0F172A",
    "--color-muted": "#EEF2F7",
    "--color-muted-foreground": "#64748B",
    "--color-primary": "#0F172A",
    "--color-primary-foreground": "#F8FAFC",
    "--color-badge": "#E5E7EB",
    "--color-ring": "rgba(100, 116, 139, 0.22)",
    "--radius-token": "0.875rem",
    "--radius-token-sm": "0.625rem",
    "--shadow-card": "0 1px 2px rgba(15, 23, 42, 0.06), 0 4px 18px -4px rgba(15, 23, 42, 0.04)",
    "--shadow-pop": "0 2px 6px rgba(15, 23, 42, 0.08), 0 8px 24px -4px rgba(15, 23, 42, 0.08)",
    "--space-panel-gap": "16px",
    "--space-card-pad": "16px",
    "--space-input-py": "10px",
  },
  dark: {
    "--color-background": "#090B0F",
    "--color-surface": "#12161C",
    "--color-panel": "#171C24",
    "--color-border": "#283241",
    "--color-foreground": "#E5E7EB",
    "--color-muted": "#1B2430",
    "--color-muted-foreground": "#94A3B8",
    "--color-primary": "#E5E7EB",
    "--color-primary-foreground": "#0F172A",
    "--color-badge": "#1F2937",
    "--color-ring": "rgba(148, 163, 184, 0.22)",
    "--radius-token": "0.875rem",
    "--radius-token-sm": "0.625rem",
    "--shadow-card": "0 1px 2px rgba(246, 246, 246, 0.12), 0 10px 28px rgba(0, 0, 0, 0.12)",
    "--shadow-pop": "0 2px 8px rgba(255, 255, 255, 0.18), 0 16px 36px rgba(0, 0, 0, 0.18)",
    "--space-panel-gap": "16px",
    "--space-card-pad": "16px",
    "--space-input-py": "10px",
  },
};

export default function App() {
  const [appTheme, setAppTheme] = useState<AppShellTheme>("dark");
  const [tokens, setTokens] = useState<TokenState>(defaultTokenState);

  const updateToken = <K extends keyof TokenState>(key: K, value: TokenState[K]) => {
    setTokens((prev) => ({ ...prev, [key]: value }));
  };

  const updateColorOverride = (theme: ThemePreset, key: EditableColorToken, value: string) => {
    setTokens((prev) => ({
      ...prev,
      colorOverrides: {
        ...prev.colorOverrides,
        [theme]: {
          ...prev.colorOverrides[theme],
          [key]: value,
        },
      },
    }));
  };

  const resetColorOverrides = (theme?: ThemePreset) => {
    setTokens((prev) => {
      if (!theme) {
        return {
          ...prev,
          colorOverrides: {
            light: {},
            dark: {},
          },
        };
      }

      return {
        ...prev,
        colorOverrides: {
          ...prev.colorOverrides,
          [theme]: {},
        },
      };
    });
  };

  const exports = buildExportArtifacts(tokens);
  const appShellVars = appShellVarsByTheme[appTheme];

  return (
    <div
      id="ps-app"
      className={[
        "ps-app",
        "min-h-full",
        "bg-[var(--color-background)] text-[var(--color-foreground)]",
      ].join(" ")}
      style={appShellVars as CSSProperties}
    >
      <div id="ps-app-shell" className="ps-app-shell mx-auto max-w-[1600px] p-4 md:p-6">
        <header
          id="ps-header"
          className="ps-header ps-shadow-card mb-4 flex flex-wrap items-start justify-between gap-3 rounded-[var(--radius-token)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4"
        >
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-muted-foreground)]">
              PatternSmith v0.1
            </p>
            <h1 className="mt-1 text-xl font-semibold">Token-Driven UI Pattern Starter Kit</h1>
            <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
              A local-first sandbox for turning pattern decisions into semantic Tailwind + React exports.
            </p>
          </div>
          <div id="ps-header-actions" className="ps-header-actions flex flex-wrap items-center justify-end gap-2">
            <div
              id="ps-app-theme-toggle"
              className="ps-app-theme-toggle inline-flex rounded-[var(--radius-token-sm)] border border-[var(--color-border)] bg-[var(--color-panel)] p-1"
            >
              {(["dark", "light"] as const).map((mode) => {
                const active = appTheme === mode;
                return (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setAppTheme(mode)}
                    className={[
                      "ps-app-theme-toggle__button",
                      "rounded-[calc(var(--radius-token-sm)-2px)] px-3 py-1.5 text-xs font-medium capitalize transition",
                      active
                        ? "bg-[var(--color-foreground)] text-[var(--color-background)]"
                        : "text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)]",
                    ].join(" ")}
                    aria-pressed={active}
                  >
                    App {mode}
                  </button>
                );
              })}
            </div>

          </div>
        </header>

        <main id="ps-main" className="ps-main grid grid-cols-1 gap-4 xl:grid-cols-[420px_minmax(0,1fr)]">
          <section id="ps-controls-column" className="ps-controls-column min-w-0 space-y-4">
            <div
              id="ps-controls-card"
              className="ps-controls-card ps-shadow-card rounded-[var(--radius-token)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4"
            >
              <ControlsPanel
                tokens={tokens}
                onChange={updateToken}
                onColorOverrideChange={updateColorOverride}
                onResetColorOverrides={resetColorOverrides}
                onReset={() => setTokens(defaultTokenState)}
              />
            </div>
          </section>

          <section
            id="ps-preview-card"
            className="ps-preview-card ps-shadow-card min-w-0 rounded-[var(--radius-token)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4"
          >
            <PreviewPanel tokens={tokens} />
          </section>
        </main>

        <footer
          id="ps-export-footer"
          className="ps-export-footer ps-shadow-card mt-4 rounded-[var(--radius-token)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4"
        >
          <ExportPanel
            cssVariables={exports.cssVariables}
            tailwindConfig={exports.tailwindConfig}
            componentsBundle={exports.componentsBundle}
          />
        </footer>
      </div>
    </div>
  );
}
