import { SOURCE_LIBRARY_LIMITS } from "./categories";

export const MAX_SAVED_FORM_CONFIGURATIONS = SOURCE_LIBRARY_LIMITS.form;

export const FORM_GROUPS = [
  {
    id: "rhythm", title: "Rhythm & Structure",
    subtitle: "Spacing, sizing, grids, containers, aspect ratios, density.",
    description: "Defines how interfaces are arranged and how much room elements occupy.",
    settings: ["sizing", "spacing", "grids", "containers", "aspect-ratios", "density"],
  },
  {
    id: "shape", title: "Shape & Edges",
    subtitle: "Radii, borders, strokes, dividers, shape language.",
    description: "Defines how elements are physically outlined and constructed.",
    settings: ["radii", "borders", "strokes", "dividers", "shape-language"],
  },
  {
    id: "surfaces", title: "Surfaces & Depth",
    subtitle: "Shadows, elevation, opacity, blur, surface treatment.",
    description: "Defines how elements separate from their background and from one another.",
    settings: ["shadows", "elevation", "opacity", "blur", "surface-treatment"],
  },
  {
    id: "behavior", title: "Behavior",
    subtitle: "Motion, easing, transition durations, interaction states.",
    description: "Defines how the interface responds and changes over time.",
    settings: ["motion", "easing", "transition-durations", "interaction-states"],
  },
] as const;

export type FormSettingId = typeof FORM_GROUPS[number]["settings"][number];
export const FORM_SETTING_LABELS: Record<FormSettingId, string> = {
  sizing: "Sizing", spacing: "Spacing", grids: "Grids", containers: "Containers",
  "aspect-ratios": "Aspect ratios", density: "Density", radii: "Radii", borders: "Borders",
  strokes: "Strokes", dividers: "Dividers", "shape-language": "Shape language",
  shadows: "Shadows", elevation: "Elevation", opacity: "Opacity", blur: "Blur",
  "surface-treatment": "Surface treatment", motion: "Motion", easing: "Easing",
  "transition-durations": "Transition durations", "interaction-states": "Interaction states",
};
export const INITIAL_FORM_SETTINGS: readonly FormSettingId[] = ["sizing", "spacing", "radii", "shadows"];

/** Editors will supply their own configuration values when implemented. */
export interface SavedFormConfiguration<T = unknown> {
  id: string;
  setting: FormSettingId;
  name: string;
  values: T;
}

export function canSaveFormConfiguration(saved: readonly SavedFormConfiguration[], item: SavedFormConfiguration): boolean {
  return saved.some(existing => existing.id === item.id && existing.setting === item.setting)
    || saved.filter(existing => existing.setting === item.setting).length < MAX_SAVED_FORM_CONFIGURATIONS;
}
