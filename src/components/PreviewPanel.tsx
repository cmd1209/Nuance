import type { CSSProperties } from "react";
import type { TokenState } from "../lib/tokens";
import { cssVarPreviewStyle } from "../lib/tokens";

type PreviewPanelProps = {
  tokens: TokenState;
};

const metricCards = [
  { label: "Revenue", value: "$42.8k", delta: "+12.4%" },
  { label: "New Signups", value: "312", delta: "+7.1%" },
  { label: "Conversion", value: "4.8%", delta: "-0.3%" },
];

function DashboardContent({ compact }: { compact: boolean }) {
  const cardPadding = compact ? "p-3" : "p-4";
  const gridGap = compact ? "gap-3" : "gap-4";
  const headerPad = compact ? "p-3" : "p-4";

  return (
    <div className="ps-preview-dashboard min-w-0 space-y-4">
      <header
        className={[
          "ps-shadow-card rounded-[var(--radius-token)] border-[length:var(--border-width-token)] border-[color:var(--color-border)] bg-[var(--color-surface)]",
          headerPad,
        ].join(" ")}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-[var(--color-foreground)]">Operations Dashboard</h2>
            <p className="text-sm text-[var(--color-muted-foreground)]">
              Preview is token-driven, so every control change updates this view.
            </p>
          </div>
          <button
            type="button"
            className="ps-shadow-pop inline-flex items-center rounded-[var(--radius-token-sm)] bg-[var(--color-primary)] px-3 py-2 text-sm font-medium text-[var(--color-primary-foreground)] transition hover:brightness-95"
          >
            Create report
          </button>
        </div>
      </header>

      <div className={`grid grid-cols-1 ${gridGap} md:grid-cols-3`}>
        {metricCards.map((card) => (
          <section
            key={card.label}
            className={[
              "ps-shadow-card rounded-[var(--radius-token)] border-[length:var(--border-width-token)] border-[color:var(--color-border)] bg-[var(--color-surface)]",
              cardPadding,
            ].join(" ")}
          >
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--color-muted-foreground)]">
              {card.label}
            </p>
            <p className="mt-2 text-2xl font-semibold text-[var(--color-foreground)]">{card.value}</p>
            <div className="mt-3 inline-flex items-center rounded-[var(--radius-token-sm)] border-[length:var(--border-width-token)] border-[color:var(--color-border)] bg-[var(--color-badge)] px-2.5 py-1 text-xs font-medium text-[var(--color-foreground)]">
              {card.delta}
            </div>
          </section>
        ))}
      </div>

      <section
        className={[
          "ps-shadow-card rounded-[var(--radius-token)] border-[length:var(--border-width-token)] border-[color:var(--color-border)] bg-[var(--color-surface)]",
          cardPadding,
        ].join(" ")}
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-[var(--color-foreground)]">Quick action</h3>
          <span className="inline-flex items-center rounded-[var(--radius-token-sm)] border-[length:var(--border-width-token)] border-[color:var(--color-border)] bg-[var(--color-muted)] px-2 py-0.5 text-xs text-[var(--color-muted-foreground)]">
            Draft
          </span>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
          <label className="block min-w-0">
            <span className="mb-1 block text-xs font-medium text-[var(--color-muted-foreground)]">Project name</span>
            <input
              defaultValue="PatternSmith Starter"
              className="ps-shadow-card w-full rounded-[var(--radius-token-sm)] border-[length:var(--border-width-token)] border-[color:var(--color-border)] bg-[var(--color-surface)] px-3 text-sm text-[var(--color-foreground)] outline-none placeholder:text-[var(--color-muted-foreground)]"
              style={{ paddingTop: "var(--space-input-py)", paddingBottom: "var(--space-input-py)" }}
            />
          </label>

          <div className="flex items-end">
            <button
              type="button"
              className="inline-flex h-[42px] items-center justify-center rounded-[var(--radius-token-sm)] border-[length:var(--border-width-token)] border-[color:var(--color-border)] bg-[var(--color-muted)] px-4 text-sm font-medium text-[var(--color-foreground)] hover:bg-[var(--color-badge)]"
            >
              Validate
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

function SidebarLayout({ compact }: { compact: boolean }) {
  const pad = compact ? "p-3" : "p-4";
  return (
    <div className="grid min-h-[520px] grid-cols-1 gap-4 xl:grid-cols-[220px_minmax(0,1fr)]">
      <aside
        className={[
          "ps-shadow-card rounded-[var(--radius-token)] border-[length:var(--border-width-token)] border-[color:var(--color-border)] bg-[var(--color-panel)]",
          pad,
        ].join(" ")}
      >
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--color-muted-foreground)]">
          Navigation
        </p>
        <div className="mt-3 space-y-2">
          {["Overview", "Reports", "Components", "Exports"].map((item, index) => (
            <div
              key={item}
              className={[
                "rounded-[var(--radius-token-sm)] border-[length:var(--border-width-token)] px-3 py-2 text-sm",
                index === 0
                  ? "border-transparent bg-[var(--color-primary)] text-[var(--color-primary-foreground)]"
                  : "border-[color:var(--color-border)] bg-[var(--color-surface)] text-[var(--color-foreground)]",
              ].join(" ")}
            >
              {item}
            </div>
          ))}
        </div>
      </aside>
      <div className="min-w-0">
        <DashboardContent compact={compact} />
      </div>
    </div>
  );
}

function TopnavLayout({ compact }: { compact: boolean }) {
  const pad = compact ? "p-3" : "p-4";
  return (
    <div className="min-h-[520px] space-y-4">
      <nav
        className={[
          "ps-shadow-card flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-token)] border-[length:var(--border-width-token)] border-[color:var(--color-border)] bg-[var(--color-panel)]",
          pad,
        ].join(" ")}
      >
        <div className="text-sm font-semibold text-[var(--color-foreground)]">PatternSmith</div>
        <div className="flex flex-wrap gap-2">
          {["Dashboard", "Tokens", "Preview", "Export"].map((item, index) => (
            <span
              key={item}
              className={[
                "rounded-[var(--radius-token-sm)] border-[length:var(--border-width-token)] px-3 py-1.5 text-xs",
                index === 0
                  ? "border-transparent bg-[var(--color-primary)] text-[var(--color-primary-foreground)]"
                  : "border-[color:var(--color-border)] bg-[var(--color-surface)] text-[var(--color-muted-foreground)]",
              ].join(" ")}
            >
              {item}
            </span>
          ))}
        </div>
      </nav>
      <DashboardContent compact={compact} />
    </div>
  );
}

function CenteredLayout({ compact }: { compact: boolean }) {
  return (
    <div className="flex min-h-[520px] items-center justify-center">
      <div className="w-full max-w-4xl min-w-0">
        <DashboardContent compact={compact} />
      </div>
    </div>
  );
}

function SplitLayout({ compact }: { compact: boolean }) {
  const pad = compact ? "p-3" : "p-4";
  return (
    <div className="grid min-h-[520px] grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
      <div className="min-w-0">
        <DashboardContent compact={compact} />
      </div>
      <section
        className={[
          "ps-shadow-card rounded-[var(--radius-token)] border-[length:var(--border-width-token)] border-[color:var(--color-border)] bg-[var(--color-panel)]",
          pad,
        ].join(" ")}
      >
        <h3 className="text-sm font-semibold text-[var(--color-foreground)]">Inspector</h3>
        <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
          This side panel is just a layout placeholder so you can feel the token decisions in a split workspace.
        </p>
        <div className="mt-4 space-y-3">
          {["Spacing scale", "Component map", "Tailwind export"].map((row) => (
            <div
              key={row}
              className="rounded-[var(--radius-token-sm)] border-[length:var(--border-width-token)] border-[color:var(--color-border)] bg-[var(--color-surface)] p-3"
            >
              <div className="text-sm font-medium text-[var(--color-foreground)]">{row}</div>
              <div className="mt-1 text-xs text-[var(--color-muted-foreground)]">
                Token-aware preview module
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export function PreviewPanel({ tokens }: PreviewPanelProps) {
  const compact = tokens.density === "compact";
  const shellPad = compact ? "p-3" : "p-4";
  const previewVars = cssVarPreviewStyle(tokens);

  return (
    <div id="ps-preview-panel" className="ps-preview-panel space-y-3">
      <div className="ps-preview-panel__header flex items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-[var(--color-foreground)]">Live Preview</h2>
          <p className="text-xs text-[var(--color-muted-foreground)]">
            Dashboard card grid using semantic token variables.
          </p>
        </div>
      </div>

      <div
        id="ps-preview-canvas"
        className={[
          "ps-preview-canvas",
          tokens.theme === "dark" ? "dark" : "",
          "ps-shadow-pop min-w-0 overflow-hidden rounded-[calc(var(--radius-token)+0.25rem)] border-[length:var(--border-width-token)] border-[color:var(--color-border)] bg-[var(--color-background)]",
          shellPad,
        ].join(" ")}
        style={previewVars as CSSProperties}
      >
        <div id={`ps-preview-layout-${tokens.layout}`} className={`ps-preview-layout ps-preview-layout--${tokens.layout}`}>
          {tokens.layout === "sidebar" && <SidebarLayout compact={compact} />}
          {tokens.layout === "topnav" && <TopnavLayout compact={compact} />}
          {tokens.layout === "centered" && <CenteredLayout compact={compact} />}
          {tokens.layout === "split" && <SplitLayout compact={compact} />}
        </div>
      </div>
    </div>
  );
}
