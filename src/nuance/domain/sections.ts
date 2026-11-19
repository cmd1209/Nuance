import type { FoundationSectionId } from "./categories";

export type SectionView = "explore" | "saved";
export type CreativeView = SectionView | "edit";

export interface FoundationSectionDefinition {
  title: string;
  descriptions: Record<CreativeView, string>;
  empty: Record<SectionView, string>;
}

/** Copy and structural configuration only; no invented selections or editor state. */
export const FOUNDATION_SECTIONS: Record<FoundationSectionId, FoundationSectionDefinition> = {
  types: {
    title: "Type",
    descriptions: {
      explore: "Explore how typography shapes character and hierarchy. Experiment with type combinations, scale, and rhythm to discover what feels right.",
      saved: "Your saved typography selections, ready to revisit and refine. Select a favorite to continue editing or explore new combinations.",
      edit: "A closer look at your selected typeface. Explore its character and readability.",
    },
    empty: {
      explore: "Typography exploration is coming soon.",
      saved: "No saved typefaces yet. Explore a font and save it to see it here.",
    },
  },
  form: {
    title: "Form",
    descriptions: {
      explore: "Explore how spacing, proportion, corners, borders, shadows, and effects work together to give interfaces structure and character.",
      saved: "Your saved form configurations, ready to revisit and refine. Select a favorite to continue editing or explore new combinations.",
      edit: "Adjust spacing, proportion, radii, strokes, shadows, and effects to create a consistent visual language.",
    },
    empty: {
      explore: "Form exploration is coming soon: spacing, proportion, corners, borders, shadows, and effects.",
      saved: "Saved form configurations will appear here when Form exploration is available.",
    },
  },
};
