import { useState } from "react";

type ExportPanelProps = {
  cssVariables: string;
  tailwindConfig: string;
  componentsBundle: string;
};

type BlockProps = {
  title: string;
  description: string;
  code: string;
  copiedKey: string | null;
  onCopy: (key: string, text: string) => void;
  copyKey: string;
};

function ExportBlock({ title, description, code, copiedKey, onCopy, copyKey }: BlockProps) {
  const copied = copiedKey === copyKey;

  return (
    <section
      id={`ps-export-block-${copyKey}`}
      className="ps-export-block ps-shadow-card space-y-2 rounded-[var(--radius-token)] border border-[var(--color-border)] bg-[var(--color-surface)] p-3"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-[var(--color-foreground)]">{title}</h3>
          <p className="text-xs text-[var(--color-muted-foreground)]">{description}</p>
        </div>
        <button
          type="button"
          onClick={() => onCopy(copyKey, code)}
          className="shrink-0 rounded-[var(--radius-token-sm)] border border-[var(--color-border)] bg-[var(--color-panel)] px-3 py-1.5 text-xs font-medium text-[var(--color-foreground)] hover:bg-[var(--color-muted)]"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>

      <pre className="ps-export-block__code max-h-44 overflow-auto rounded-[var(--radius-token-sm)] border border-[var(--color-border)] bg-black/90 p-3 text-xs leading-5 text-slate-100">
        <code>{code}</code>
      </pre>
    </section>
  );
}

export function ExportPanel({ cssVariables, tailwindConfig, componentsBundle }: ExportPanelProps) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const copyText = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      window.setTimeout(() => setCopiedKey((current) => (current === key ? null : current)), 1200);
    } catch {
      // This fallback keeps the demo usable in stricter browser contexts.
      const textarea = document.createElement("textarea");
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopiedKey(key);
      window.setTimeout(() => setCopiedKey((current) => (current === key ? null : current)), 1200);
    }
  };

  return (
    <div id="ps-export-panel" className="ps-export-panel space-y-3">
      <div>
        <h2 className="text-base font-semibold text-[var(--color-foreground)]">Export</h2>
        <p className="text-xs text-[var(--color-muted-foreground)]">
          Copy CSS vars, Tailwind theme extension, and starter React components.
        </p>
      </div>

      <ExportBlock
        title="CSS Variables"
        description="Paste into your global stylesheet to define :root and .dark tokens."
        code={cssVariables}
        copiedKey={copiedKey}
        onCopy={copyText}
        copyKey="css"
      />

      <ExportBlock
        title="tailwind.config Theme Extension"
        description="Merge into your Tailwind theme.extend to map semantic names to CSS variables."
        code={tailwindConfig}
        copiedKey={copiedKey}
        onCopy={copyText}
        copyKey="tailwind"
      />

      <ExportBlock
        title="React Component Starter Kit (4 files)"
        description="Includes Button, Card, Input, and Badge components using semantic Tailwind classes."
        code={componentsBundle}
        copiedKey={copiedKey}
        onCopy={copyText}
        copyKey="components"
      />
    </div>
  );
}
