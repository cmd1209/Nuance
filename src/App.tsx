import { useState, type CSSProperties } from "react";
import { ControlsPanel } from "./components/ControlsPanel";
import { ExportPanel } from "./components/ExportPanel";
import { PreviewPanel } from "./components/PreviewPanel";
import {
  buildExportArtifacts,
  cssVarPreviewStyle,
  defaultTokenState,
  formatTokenSummary,
  type EditableColorToken,
  type ThemePreset,
  type TokenState,
} from "./lib/tokens";

export default function App() {
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
  const styleVars = cssVarPreviewStyle(tokens);

  return (
    <div
      className={[
        "min-h-full",
        tokens.theme === "dark" ? "dark" : "",
        "bg-[var(--color-background)] text-[var(--color-foreground)]",
      ].join(" ")}
      style={styleVars as CSSProperties}
    >
      <div className="mx-auto max-w-[1600px] p-4 md:p-6">
        <header className="mb-4 flex flex-wrap items-start justify-between gap-3 rounded-[var(--radius-token)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-card)]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-muted-foreground)]">
              PatternSmith v0.1
            </p>
            <h1 className="mt-1 text-xl font-semibold">Token-Driven UI Pattern Starter Kit</h1>
            <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
              A local-first sandbox for turning pattern decisions into semantic Tailwind + React exports.
            </p>
          </div>
          <div className="rounded-[var(--radius-token-sm)] border border-[var(--color-border)] bg-[var(--color-panel)] px-3 py-2 text-xs text-[var(--color-muted-foreground)]">
            {formatTokenSummary(tokens)}
          </div>
        </header>

        <main className="grid grid-cols-1 gap-4 xl:grid-cols-[420px_minmax(0,1fr)]">
          <section className="min-w-0 space-y-4">
            <div className="rounded-[var(--radius-token)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-card)]">
              <ControlsPanel
                tokens={tokens}
                onChange={updateToken}
                onColorOverrideChange={updateColorOverride}
                onResetColorOverrides={resetColorOverrides}
                onReset={() => setTokens(defaultTokenState)}
              />
            </div>
          </section>

          <section className="min-w-0 rounded-[var(--radius-token)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-card)]">
            <PreviewPanel tokens={tokens} />
          </section>
        </main>

        <footer className="mt-4 rounded-[var(--radius-token)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-card)]">
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
