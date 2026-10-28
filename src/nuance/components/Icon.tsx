import type { CSSProperties } from "react";

export type IconName = "color" | "type" | "space" | "detail" | "user" | "moon" | "plus" | "minus" | "back" | "adjust" | "download";
export function Icon({ name, size = 16 }: { name: IconName; size?: 16 | 20 }) {
  // Unmodified Figma SVG geometry; a mask lets it inherit the semantic UI color.
  return <span aria-hidden="true" className="nuance-icon" style={{ "--icon-url": `url('/nuance/icons/${name}.svg')`, width: size, height: size } as CSSProperties} />;
}
