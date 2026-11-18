import type { CSSProperties } from "react";
import type { Rect } from "../domain/layout";

/** Keep proportions responsive while gutters stay the same CSS size in every view. */
export function regionStyle(rect: Rect): CSSProperties {
  const left = rect.x > 1e-9;
  const top = rect.y > 1e-9;
  const right = rect.x + rect.width < 1 - 1e-9;
  const bottom = rect.y + rect.height < 1 - 1e-9;
  const extent = (value: number, start: boolean, end: boolean) => {
    const halves = Number(start) + Number(end);
    return halves ? `calc(${value * 100}% - var(--color-block-gap)${halves === 1 ? " / 2" : ""})` : `${value * 100}%`;
  };
  return {
    left: left ? `calc(${rect.x * 100}% + var(--color-block-gap) / 2)` : "0%",
    top: top ? `calc(${rect.y * 100}% + var(--color-block-gap) / 2)` : "0%",
    width: extent(rect.width, left, right),
    height: extent(rect.height, top, bottom),
  };
}
