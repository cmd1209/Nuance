import { useState } from "react";
import type { EditableColorToken, ThemePreset, TokenState } from "../lib/tokens";
import { accentOptions, editableColorOptions, getEditableColorValues, tokenOptionLabels } from "../lib/tokens";

type ControlsPanelProps = {
  tokens: TokenState;
  onChange: <K extends keyof TokenState>(key: K, value: TokenState[K]) => void;
  onColorOverrideChange: (theme: ThemePreset, key: EditableColorToken, value: string) => void;
  onResetColorOverrides: (theme?: ThemePreset) => void;
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

export function ControlsPanel({
  tokens,
  onChange,
  onColorOverrideChange,
  onResetColorOverrides,
  onReset,
}: ControlsPanelProps) {
  const [showAdvancedColors, setShowAdvancedColors] = useState(false);
  const colorValues = getEditableColorValues(tokens, tokens.theme);
  const activeThemeOverrideCount = Object.keys(tokens.colorOverrides[tokens.theme]).length;

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
                  className="h-4 w-4 rounded-[var(--radius-token-sm)] border border-black/10"
                  style={{ backgroundColor: accent.swatch }}
                  aria-hidden="true"
                />
                <span className="truncate text-[var(--color-foreground)]">{accent.label}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="rounded-[var(--radius-token)] border border-[var(--color-border)] bg-[var(--color-panel)] p-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-[var(--color-foreground)]">Advanced Colors</h3>
            <p className="text-xs text-[var(--color-muted-foreground)]">
              Fine-tune semantic tokens for the current <span className="font-medium">{tokens.theme}</span> theme.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowAdvancedColors((open) => !open)}
            className="rounded-[var(--radius-token-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-xs font-medium text-[var(--color-foreground)] hover:bg-[var(--color-muted)]"
          >
            {showAdvancedColors ? "Hide" : "Edit"}
          </button>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[var(--color-muted-foreground)]">
          <span className="rounded-[var(--radius-token-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1">
            Editing: {tokens.theme}
          </span>
          <span className="rounded-[var(--radius-token-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1">
            Overrides: {activeThemeOverrideCount}
          </span>
        </div>

        {showAdvancedColors ? (
          <div className="mt-3 space-y-3">
            <div className="grid grid-cols-1 gap-2">
              {editableColorOptions.map((item) => (
                <label
                  key={item.key}
                  className="flex items-center gap-3 rounded-[var(--radius-token-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] p-2"
                >
                  <input
                    type="color"
                    value={colorValues[item.key]}
                    onChange={(event) => onColorOverrideChange(tokens.theme, item.key, event.target.value)}
                    className="h-9 w-10 cursor-pointer rounded border border-[var(--color-border)] bg-transparent p-0"
                    aria-label={`${item.label} color`}
                  />

                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-[var(--color-foreground)]">{item.label}</div>
                    <div className="truncate text-xs text-[var(--color-muted-foreground)]">{item.description}</div>
                  </div>
                </label>
              ))}
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => onResetColorOverrides(tokens.theme)}
                className="rounded-[var(--radius-token-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-xs font-medium text-[var(--color-foreground)] hover:bg-[var(--color-muted)]"
              >
                Reset {tokens.theme} colors
              </button>
              <button
                type="button"
                onClick={() => onResetColorOverrides()}
                className="rounded-[var(--radius-token-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-xs font-medium text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)]"
              >
                Reset all colors
              </button>
            </div>
          </div>
        ) : null}
      </section>

      <section className="rounded-[var(--radius-token)] border border-dashed border-[var(--color-border)] bg-[var(--color-panel)] p-3 text-xs text-[var(--color-muted-foreground)]">
        Current preset starts from <span className="font-semibold text-[var(--color-foreground)]">v0.1 defaults</span>{" "}
        and updates live. No backend, no persistence, no magic.
      </section>
    </div>
  );
}
