export type SizingPrecision = 1 | 2 | 4;
export type ThreePoints = [number, number, number];
export const SIZING_GENERATOR_VERSION = "monotone-cubic-v1";
export const DEFAULT_POINT_POSITIONS: ThreePoints = [0.25, 0.5, 0.75];
export const MIN_POINT_DISTANCE = 0.04;

export interface SizingConfiguration {
  maxSize: number;
  precision: SizingPrecision;
  steps: number;
  points: ThreePoints;
  positions: ThreePoints;
}

export function createSizingConfiguration(): SizingConfiguration {
  return { maxSize: 128, precision: 1, steps: 10, points: [0.0625, 0.25, 0.5625], positions: [...DEFAULT_POINT_POSITIONS] };
}

export function sizingConstraint(maxSize: number, precision: number, steps: number): string {
  if (![1, 2, 4].includes(precision)) return "Choose 1px, 2px or 4px precision.";
  if (!Number.isInteger(steps) || steps < 6 || steps > 12) return "Choose between 6 and 12 steps.";
  if (!Number.isInteger(maxSize) || maxSize > 4096 || maxSize < steps * precision || maxSize % precision !== 0) {
    return `Use a maximum that is a multiple of ${precision}px, from ${steps * precision}px to ${Math.floor(4096 / precision) * precision}px.`;
  }
  return "";
}

export function moveSizingPoint(configuration: SizingConfiguration, index: number, value: number, position?: number): SizingConfiguration {
  const points: ThreePoints = [...configuration.points];
  const positions: ThreePoints = [...configuration.positions];
  points[index] = Math.max(points[index - 1] ?? 0, Math.min(points[index + 1] ?? 1, value));
  if (position !== undefined) {
    positions[index] = Math.max((positions[index - 1] ?? 0) + MIN_POINT_DISTANCE,
      Math.min((positions[index + 1] ?? 1) - MIN_POINT_DISTANCE, position));
  }
  return { ...configuration, points, positions };
}

/** The same monotone cubic model as the original editor, with nonuniform knot spacing. */
export function sizingCurve(points: ThreePoints, position: number, positions: ThreePoints = DEFAULT_POINT_POSITIONS): number {
  const values = [0, ...points, 1];
  const knots = [0, ...positions, 1];
  const widths = knots.slice(1).map((value, index) => value - knots[index]);
  const slopes = values.slice(1).map((value, index) => (value - values[index]) / widths[index]);
  const tangents = values.map((_, index) => {
    if (index === 0) return slopes[0];
    if (index === 4) return slopes[3];
    const before = slopes[index - 1], after = slopes[index];
    const first = 2 * widths[index] + widths[index - 1];
    const second = widths[index] + 2 * widths[index - 1];
    return before * after > 0 ? (first + second) / (first / before + second / after) : 0;
  });
  const x = Math.max(0, Math.min(1, position));
  if (x === 0) return 0;
  if (x === 1) return 1;
  const segment = Math.min(3, Math.max(0, knots.findIndex(knot => knot > x) - 1));
  const t = (x - knots[segment]) / widths[segment];
  return (2 * t ** 3 - 3 * t ** 2 + 1) * values[segment]
    + (t ** 3 - 2 * t ** 2 + t) * tangents[segment] * widths[segment]
    + (-2 * t ** 3 + 3 * t ** 2) * values[segment + 1]
    + (t ** 3 - t ** 2) * tangents[segment + 1] * widths[segment];
}

export function sizingTokens(configuration: SizingConfiguration) {
  const { maxSize, precision, steps, points, positions } = configuration;
  const error = sizingConstraint(maxSize, precision, steps);
  if (error) throw new Error(error);
  const maximumUnit = maxSize / precision;
  let previousUnit = 0;
  return Array.from({ length: steps + 1 }, (_, index) => {
    if (index === 0) return { name: "size-0", value: 0 };
    // Reserve one precision increment for every remaining token, including the fixed maximum.
    const desired = Math.round(sizingCurve(points, index / steps, positions) * maximumUnit);
    const unit = index === steps ? maximumUnit : Math.max(previousUnit + 1, Math.min(maximumUnit - (steps - index), desired));
    previousUnit = unit;
    return { name: `size-${index}`, value: unit * precision };
  });
}

export function sizingCurvePath(configuration: SizingConfiguration): string {
  return Array.from({ length: 101 }, (_, index) => {
    const x = index / 100;
    return `${index ? "L" : "M"}${x * 100},${(1 - sizingCurve(configuration.points, x, configuration.positions)) * 100}`;
  }).join(" ");
}
