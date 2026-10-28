import { useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from "react";
import { type Composition } from "../domain/composition";
import { computeLayout, paintedRect, type Divider } from "../domain/layout";
import { Icon } from "./Icon";

export interface ArtworkProps {
  composition: Composition;
  selectedColorId: string | null;
  onSelect: (id: string) => void;
  onAdjust: (id: string) => void;
  onResize: (splitId: string, ratio: number) => void;
}
function contentColor(hex: string) {
  const rgb = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722 > 0.179 ? "var(--colors-primary-900)" : "var(--colors-primary-white)";
}
export function Artwork({ composition, selectedColorId, onSelect, onAdjust, onResize }: ArtworkProps) {
  const root = useRef<HTMLDivElement>(null);
  const dragging = useRef<{ pointerId: number; divider: Divider; bounds: DOMRect } | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const { regions, dividers } = computeLayout(composition.layout);
  function start(event: PointerEvent<HTMLDivElement>, divider: Divider) {
    if (event.button !== 0) return;
    event.preventDefault(); event.stopPropagation();
    const bounds = root.current!.getBoundingClientRect();
    // Capture keeps dragging alive outside a thin divider, for mouse, pen and touch.
    event.currentTarget.setPointerCapture(event.pointerId);
    dragging.current = { pointerId: event.pointerId, divider, bounds }; setDragId(divider.id);
  }
  function move(event: PointerEvent<HTMLDivElement>) {
    const drag = dragging.current;
    if (!drag || event.pointerId !== drag.pointerId) return;
    const { bounds, divider } = drag;
    const global = divider.axis === "x" ? (event.clientX - bounds.left) / bounds.width : (event.clientY - bounds.top) / bounds.height;
    const origin = divider.axis === "x" ? divider.bounds.x : divider.bounds.y;
    const extent = divider.axis === "x" ? divider.bounds.width : divider.bounds.height;
    onResize(divider.id, (global - origin) / extent);
  }
  function finish(event: PointerEvent<HTMLDivElement>) {
    if (dragging.current?.pointerId !== event.pointerId) return;
    dragging.current = null; setDragId(null);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }
  function keyResize(event: KeyboardEvent, divider: Divider) {
    const negative = divider.axis === "x" ? "ArrowLeft" : "ArrowUp", positive = divider.axis === "x" ? "ArrowRight" : "ArrowDown";
    let ratio: number;
    if (event.key === negative || event.key === positive) ratio = divider.ratio + (event.key === negative ? -1 : 1) * (event.shiftKey ? 0.1 : 0.02);
    else if (event.key === "Home") ratio = divider.min;
    else if (event.key === "End") ratio = divider.max;
    else return;
    event.preventDefault(); onResize(divider.id, ratio);
  }
  return <div ref={root} className={`composition-artwork ${dragId ? "is-resizing" : ""}`} data-testid="composition-artwork"
    aria-label="Editable color composition" style={{ aspectRatio: `${composition.artwork.width} / ${composition.artwork.height}` }}>
    {regions.map((region, index) => {
      const color = composition.colors.find(c => c.id === region.colorId)!;
      const rect = paintedRect(region, composition.artwork), selected = selectedColorId === color.id;
      return <button type="button" key={region.id} className={`color-region ${selected ? "is-selected" : ""}`} aria-pressed={selected}
        aria-label={`Color ${index + 1}: ${color.hex}${color.origin === "generated" ? ", Nuance-generated extension" : color.origin === "user" ? ", custom color" : color.name ? `, ${color.name}` : ""}`} data-color-id={color.id} data-hex={color.hex}
        onClick={() => onSelect(color.id)} onDoubleClick={() => onAdjust(color.id)}
        style={{ left: `${rect.x * 100}%`, top: `${rect.y * 100}%`, width: `${rect.width * 100}%`, height: `${rect.height * 100}%`, background: color.hex, color: contentColor(color.hex) }}>
        <span className="color-region__details"><span>{color.hex}</span><span className="color-region__adjust"
          onClick={event => { event.stopPropagation(); onAdjust(color.id); }}><Icon name="adjust" />Adjust</span></span>
      </button>;
    })}
    {dividers.map((divider, index) => {
      const x = divider.axis === "x";
      const style: CSSProperties = x ? { left: `${divider.position * 100}%`, top: `${divider.bounds.y * 100}%`, height: `${divider.bounds.height * 100}%` }
        : { top: `${divider.position * 100}%`, left: `${divider.bounds.x * 100}%`, width: `${divider.bounds.width * 100}%` };
      return <div key={divider.id} role="separator" tabIndex={0} className={`resize-divider resize-divider--${divider.axis} ${dragId === divider.id ? "is-dragging" : ""}`}
        aria-label={`Resize ${x ? "vertical" : "horizontal"} boundary ${index + 1}`} aria-orientation={x ? "vertical" : "horizontal"}
        aria-valuemin={Math.round(divider.min * 100)} aria-valuemax={Math.round(divider.max * 100)} aria-valuenow={Math.round(divider.ratio * 100)}
        aria-valuetext={`${Math.round(divider.ratio * 100)} percent`} style={style}
        onPointerDown={e => start(e, divider)} onPointerMove={move} onPointerUp={finish} onPointerCancel={finish}
        onLostPointerCapture={() => { dragging.current = null; setDragId(null); }} onKeyDown={e => keyResize(e, divider)} />;
    })}
  </div>;
}
