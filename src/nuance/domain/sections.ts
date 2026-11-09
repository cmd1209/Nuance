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
    title: "Types",
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
  spaces: {
    title: "Spaces",
    descriptions: {
      explore: "Explore how spacing creates structure and rhythm. Discover how small changes in distance and proportion can transform a layout.",
      saved: "Your saved spacing systems, ready to revisit and refine. Select a favorite to continue editing or explore new possibilities.",
      edit: "Adjust spacing values and relationships to create a consistent rhythm throughout your design.",
    },
    empty: {
      explore: "Spacing exploration is coming soon.",
      saved: "Saved spacing systems will appear here when spacing exploration is available.",
    },
  },
  details: {
    title: "Details",
    descriptions: {
      explore: "Explore the subtle details that give interfaces their character. Discover combinations of corners, borders, shadows, and effects.",
      saved: "Your saved detail configurations, ready to revisit and refine. Select a favorite to continue editing or explore new combinations.",
      edit: "Fine-tune radii, strokes, shadows, and effects to create a consistent visual language.",
    },
    empty: {
      explore: "Exploration of corners, borders, shadows, and effects is coming soon.",
      saved: "Saved detail configurations will appear here when details exploration is available.",
    },
  },
};
