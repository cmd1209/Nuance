import { paletteAttribution, type Composition } from "../domain/composition";
import { computeLayout, paintedRect } from "../domain/layout";

export function PaletteCard({ composition, onSelect, disabled = false }: { composition: Composition; onSelect: () => void; disabled?: boolean }) {
  return <button type="button" className="palette-card" onClick={onSelect} disabled={disabled}
    aria-label={`Edit ${composition.name}: ${composition.colors.map(c => c.hex).join(", ")}`}>
    <span className="palette-card__artwork" aria-hidden="true">
      {computeLayout(composition.layout).regions.map(region => {
        const rect = paintedRect(region, { width: 276, height: 176, gap: 8 });
        return <span key={region.id} className="palette-card__color" style={{ left: `${rect.x * 100}%`, top: `${rect.y * 100}%`, width: `${rect.width * 100}%`, height: `${rect.height * 100}%`, background: composition.colors.find(c => c.id === region.colorId)!.hex }} />;
      })}
    </span>
  </button>;
}
