import { sizingCurvePath, type SizingConfiguration } from "../../domain/sizing";

export function SizingMiniature({ value }: { value: SizingConfiguration }) {
  return <div className="form-study-preview">
    <svg viewBox="-2 -2 104 104" preserveAspectRatio="none" aria-hidden="true">
      <path d={sizingCurvePath(value)} />
    </svg>
    <span>{value.maxSize}px · {value.steps} steps · {value.precision}px</span>
  </div>;
}
