import { paletteAttribution, type Composition } from "../domain/composition";
import { computeLayout } from "../domain/layout";
import { regionStyle } from "./regionStyle";

export function PaletteCard({ composition, onSelect, disabled = false, showName = false, actionLabel, occurrence, artwork = { width: 276, height: 176, gap: 8 } }: { composition: Composition; onSelect: () => void; disabled?: boolean; showName?: boolean; actionLabel?: string; occurrence?: number; artwork?: Composition["artwork"] }) {
  return <button type="button" className="palette-card" data-composition-id={composition.id} data-palette-index={occurrence} onClick={onSelect} disabled={disabled}
    aria-label={actionLabel ?? `Edit ${composition.name}: ${composition.colors.map(c => c.hex).join(", ")}`}>
    {showName && <span className="palette-card__label composition-source__name">{paletteAttribution(composition)}</span>}
    <span className="palette-card__artwork" aria-hidden="true" style={{ aspectRatio: `${artwork.width} / ${artwork.height}` }}>
      {computeLayout(composition.layout).regions.map(region => {
        return <span key={region.id} className="palette-card__color" style={{ ...regionStyle(region), background: composition.colors.find(c => c.id === region.colorId)!.hex }} />;
      })}
    </span>
  </button>;
}
