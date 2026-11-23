import { useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { moveSizingPoint, sizingConstraint, sizingCurve, sizingCurvePath, sizingTokens, type SizingConfiguration, type SizingPrecision } from "../../domain/sizing";
import "./sizing.css";

export function SizingEditor({ value, onChange, onValidityChange }: {
  value: SizingConfiguration;
  onChange: (value: SizingConfiguration) => void;
  onValidityChange?: (valid: boolean) => void;
}) {
  const plot = useRef<HTMLDivElement>(null);
  const dragStart = useRef<{ pointer: number; index: number; clientX: number; clientY: number; x: number; y: number } | null>(null);
  const [activePoint, setActivePoint] = useState<number | null>(null);
  const [maxInput, setMaxInput] = useState(String(value.maxSize));
  const prefix = useId();
  const maxError = sizingConstraint(Number(maxInput), value.precision, value.steps);
  useEffect(() => { setMaxInput(String(value.maxSize)); }, [value.maxSize, value.precision, value.steps]);
  useEffect(() => { onValidityChange?.(!maxError); }, [maxError, onValidityChange]);
  const tokens = sizingTokens(value);

  function drag(event: PointerEvent<HTMLButtonElement>, index: number) {
    const start = dragStart.current;
    if (!start || start.pointer !== event.pointerId || start.index !== index || !plot.current) return;
    const bounds = plot.current.getBoundingClientRect();
    // Use the grab offset instead of jumping the point to the edge of its hit area.
    onChange(moveSizingPoint(value, index, start.y - (event.clientY - start.clientY) / bounds.height,
      start.x + (event.clientX - start.clientX) / bounds.width));
  }

  function release(event: PointerEvent<HTMLButtonElement>) {
    if (dragStart.current?.pointer !== event.pointerId) return;
    dragStart.current = null;
    setActivePoint(null);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }

  function moveWithKeyboard(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const step = event.shiftKey ? 0.05 : 0.01;
    let y = value.points[index], x = value.positions[index];
    switch (event.key) {
      case "ArrowUp": y += step; break;
      case "ArrowDown": y -= step; break;
      case "ArrowRight": x += step; break;
      case "ArrowLeft": x -= step; break;
      case "Home": y = value.points[index - 1] ?? 0; break;
      case "End": y = value.points[index + 1] ?? 1; break;
      default: return;
    }
    event.preventDefault();
    onChange(moveSizingPoint(value, index, y, x));
  }

  return <div className="sizing-editor">
    <div className="sizing-editor__workspace">
      <div className="sizing-editor__controls">
        <label className="sizing-editor__max">
          <span>Max size</span>
          <span className="sizing-editor__input">
            <input type="number" aria-label="Max size" min={value.steps * value.precision} max={4096} step={value.precision} value={maxInput}
              aria-invalid={!!maxError} aria-describedby={maxError ? `${prefix}-max-error` : undefined}
              onChange={event => {
                setMaxInput(event.target.value);
                const next = event.target.valueAsNumber;
                if (!sizingConstraint(next, value.precision, value.steps)) onChange({ ...value, maxSize: next });
              }} />
            <span aria-hidden="true">px</span>
          </span>
        </label>
        <label className="sizing-editor__steps">
          <span>Steps</span>
          <select aria-label="Steps" value={value.steps} onChange={event => onChange({ ...value, steps: Number(event.target.value) })}>
            {Array.from({ length: 7 }, (_, index) => index + 6).map(steps => <option key={steps} value={steps}
              disabled={!!sizingConstraint(value.maxSize, value.precision, steps)}>{steps}</option>)}
          </select>
        </label>
        <fieldset className="sizing-editor__precision">
          <legend>Precision</legend>
          <div className="sizing-editor__segments">
            {([1, 2, 4] as SizingPrecision[]).map(precision => {
              const unavailable = sizingConstraint(value.maxSize, precision, value.steps);
              return <button key={precision} type="button" aria-pressed={value.precision === precision}
                disabled={!!unavailable} title={unavailable || `${precision}px precision`}
                onClick={() => onChange({ ...value, precision })}>{precision}px</button>;
            })}
          </div>
        </fieldset>
      </div>
      {maxError && <p id={`${prefix}-max-error`} className="sizing-editor__error" role="alert">{maxError}</p>}
      <div className="sizing-editor__graph">
        <span className="sizing-editor__axis-max">{value.maxSize}px</span>
        <div ref={plot} className={`sizing-editor__plot${activePoint !== null ? " is-dragging" : ""}`} role="group" aria-label="Sizing curve">
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            {[0, 25, 50, 75, 100].map(position => <g key={position} className="sizing-editor__grid-line">
              <line x1={position} y1="0" x2={position} y2="100" />
              <line x1="0" y1={position} x2="100" y2={position} />
            </g>)}
            <path className="sizing-editor__curve" d={sizingCurvePath(value)} />
            {tokens.map((token, index) => {
              const x = index / value.steps * 100;
              const curveY = (1 - sizingCurve(value.points, index / value.steps, value.positions)) * 100;
              const snappedY = (1 - token.value / value.maxSize) * 100;
              return <g key={token.name}>
                <line className="sizing-editor__quantization" x1={x} y1={curveY} x2={x} y2={snappedY} />
                <circle className="sizing-editor__sample" cx={x} cy={snappedY} r="0.8" />
              </g>;
            })}
          </svg>
          {value.points.map((point, index) => <button key={index} type="button"
            className={`sizing-editor__point${activePoint === index ? " is-active" : ""}`} role="slider" aria-label={`Curve point ${index + 1}`}
            aria-orientation="vertical" aria-valuemin={Math.round((value.points[index - 1] ?? 0) * 100)}
            aria-valuemax={Math.round((value.points[index + 1] ?? 1) * 100)} aria-valuenow={Math.round(point * 100)}
            aria-valuetext={`${Math.round(value.positions[index] * 100)}% along the scale, ${Math.round(point * value.maxSize * 10) / 10}px`}
            aria-describedby={`${prefix}-hint`}
            style={{ left: `${value.positions[index] * 100}%`, top: `${(1 - point) * 100}%` }}
            onPointerDown={event => {
              if (event.button !== 0 || dragStart.current) return;
              dragStart.current = { pointer: event.pointerId, index, clientX: event.clientX, clientY: event.clientY,
                x: value.positions[index], y: point };
              setActivePoint(index);
              event.currentTarget.setPointerCapture(event.pointerId);
            }}
            onPointerMove={event => drag(event, index)} onPointerUp={release} onPointerCancel={release}
            onLostPointerCapture={() => { dragStart.current = null; setActivePoint(null); }}
            onKeyDown={event => moveWithKeyboard(event, index)} />)}
        </div>
        <div className="sizing-editor__axis"><span>0</span><span>size-{value.steps}</span></div>
      </div>
      <p id={`${prefix}-hint`} className="sizing-editor__hint">Drag any of the three points in either direction. Arrow keys move them too.</p>
    </div>
    <table className="sizing-editor__tokens" aria-label="Generated size tokens">
      <thead><tr><th scope="col">Token</th><th scope="col">Value</th><th scope="col" aria-label="Size specimen" /></tr></thead>
      <tbody>{tokens.map(token => <tr key={token.name}>
        <th scope="row">{token.name}</th><td>{token.value}px</td>
        <td className="sizing-editor__specimen-cell"><span className="sizing-editor__specimen" aria-hidden="true"
          style={{ width: `${token.value / value.maxSize * 100}%` }} /></td>
      </tr>)}</tbody>
    </table>
  </div>;
}
