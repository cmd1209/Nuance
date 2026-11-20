import {
  AlignJustify, Blend, Droplets, Grid2X2, Layers, MousePointerClick, MoveRight,
  PaintBucket, PanelsTopLeft, PenLine, Proportions, Radius, Scaling,
  SeparatorHorizontal, Shapes, Spline, Square, SquarePadding, SquareStack, Timer,
  type LucideIcon,
} from "lucide-react";
import type { FormSettingId } from "../../domain/form";

const FORM_SETTING_ICONS: Record<FormSettingId, LucideIcon> = {
  spacing: SquarePadding,
  sizing: Scaling,
  grids: Grid2X2,
  containers: PanelsTopLeft,
  "aspect-ratios": Proportions,
  density: AlignJustify,
  radii: Radius,
  borders: Square,
  strokes: PenLine,
  dividers: SeparatorHorizontal,
  "shape-language": Shapes,
  shadows: SquareStack,
  elevation: Layers,
  opacity: Blend,
  blur: Droplets,
  "surface-treatment": PaintBucket,
  motion: MoveRight,
  easing: Spline,
  "transition-durations": Timer,
  "interaction-states": MousePointerClick,
};

export function FormSettingIcon({ setting }: { setting: FormSettingId }) {
  const Icon = FORM_SETTING_ICONS[setting];
  return <Icon size={20} aria-hidden="true" />;
}
