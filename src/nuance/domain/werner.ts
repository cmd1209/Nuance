import rawColors from "../data/werner/v1/colors.json";
import provenance from "../data/werner/v1/provenance.json";

export const WERNER_DATASET_VERSION = 1 as const;
export interface WernerColor {
  readonly id: string;
  readonly source: "werner-1821";
  readonly number: number;
  readonly name: string;
  readonly hex: string;
  readonly family: string;
  readonly alias: string | null;
  readonly characteristic: boolean;
  readonly references: Readonly<{ animal: string | null; vegetable: string | null; mineral: string | null }>;
}
function freeze<T>(value: T): T {
  if (value && typeof value === "object") { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}
export const WERNER_COLORS: readonly WernerColor[] = freeze(rawColors as WernerColor[]);
export const WERNER_PROVENANCE = freeze(provenance);
export const wernerColor = (id: string): WernerColor => {
  const color = WERNER_COLORS.find(item => item.id === id);
  if (!color) throw new Error(`Unknown Werner color: ${id}`);
  return color;
};
