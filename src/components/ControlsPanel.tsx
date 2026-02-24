import type { TokenState } from "../lib/tokens";
import { accentOptions, tokenOptionLabels } from "../lib/tokens";

type ControlsPanelProps = {
  tokens: TokenState;
  onChange: <K extends keyof TokenState>(key: K, value: TokenState[K]) => void;
  onReset: () => void;
};

type SegmentedProps<T extends string> = {
  label: string;
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
};

function SegmentedControl<T extends string>({ label, value, options, onChange }: SegmentedProps<T>) {
  return (
    <section className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--color-muted-foreground)]">
        {label}
      </h3>
      <div className="grid grid-cols-2 gap-2">
        {options.map((option) => {
          const active = option.value === value;

          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              className={[
                "rounded-[var(--radius-token-sm)] border px-3 py-2 text-sm transition",
                active
                  ? "border-transparent bg-[var(--color-primary)] text-[var(--color-primary-foreground)] shadow-[var(--shadow-card)]"
                  : "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-foreground)] hover:bg-[var(--color-muted)]",
              ].join(" ")}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </section>
  );
}

export function ControlsPanel({ tokens, onChange, onReset }: ControlsPanelProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-[var(--color-foreground)]">Controls</h2>
          <p className="text-xs text-[var(--color-muted-foreground)]">
            Pick semantic UI decisions, then export starter code.
          </p>
        </div>
        <button
          type="button"
          onClick={onReset}
          className="rounded-[var(--radius-token-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-xs font-medium text-[var(--color-foreground)] hover:bg-[var(--color-muted)]"
        >
          Reset
        </button>
      </div>

      <SegmentedControl
        label="Layout"
        value={tokens.layout}
        options={tokenOptionLabels.layout}
        onChange={(value) => onChange("layout", value)}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <SegmentedControl
          label="Density"
          value={tokens.density}
          options={tokenOptionLabels.density}
          onChange={(value) => onChange("density", value)}
        />
        <SegmentedControl
          label="Theme"
          value={tokens.theme}
          options={tokenOptionLabels.theme}
          onChange={(value) => onChange("theme", value)}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <SegmentedControl
          label="Radius"
          value={tokens.radius}
          options={tokenOptionLabels.radius}
          onChange={(value) => onChange("radius", value)}
        />
        <SegmentedControl
          label="Shadow"
          value={tokens.shadow}
          options={tokenOptionLabels.shadow}
          onChange={(value) => onChange("shadow", value)}
        />
      </div>

      <section className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--color-muted-foreground)]">
            Accent
          </h3>
          <span className="text-xs text-[var(--color-muted-foreground)]">
            {accentOptions.find((option) => option.key === tokens.accent)?.label}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {accentOptions.map((accent) => {
            const active = accent.key === tokens.accent;

            return (
              <button
                key={accent.key}
                type="button"
                onClick={() => onChange("accent", accent.key)}
                className={[
                  "flex items-center gap-2 rounded-[var(--radius-token-sm)] border px-2 py-2 text-left text-xs",
                  active
                    ? "border-[var(--color-primary)] bg-[var(--color-muted)]"
                    : "border-[var(--color-border)] bg-[var(--color-surface)] hover:bg-[var(--color-muted)]",
                ].join(" ")}
                title={accent.label}
              >
                <span
                  className="h-4 w-4 rounded-full border border-black/10"
                  style={{ backgroundColor: accent.swatch }}
                  aria-hidden="true"
                />
                <span className="truncate text-[var(--color-foreground)]">{accent.label}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="rounded-[var(--radius-token)] border border-dashed border-[var(--color-border)] bg-[var(--color-panel)] p-3 text-xs text-[var(--color-muted-foreground)]">
        Current preset starts from <span className="font-semibold text-[var(--color-foreground)]">v0.1 defaults</span>{" "}
        and updates live. No backend, no persistence, no magic.
      </section>
    </div>
  );
}
