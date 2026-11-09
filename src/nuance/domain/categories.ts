export const DESIGN_CATEGORIES = [
  { id: "colors", label: "Colors", enabled: true },
  { id: "types", label: "Types", enabled: true },
  { id: "spaces", label: "Spaces", enabled: true },
  { id: "details", label: "Details", enabled: true },
  { id: "designs", label: "Designs", enabled: true },
] as const;

export type DesignCategoryId = typeof DESIGN_CATEGORIES[number]["id"];
export type FoundationSectionId = Exclude<DesignCategoryId, "colors" | "designs">;

// Each source library has its own allowance. Designs will combine one of each.
export const SOURCE_LIBRARY_LIMITS = { colors: 8, types: 8, spaces: 4, details: 4 } as const;
