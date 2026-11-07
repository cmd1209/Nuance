export const DESIGN_CATEGORIES = [
  { id: "colors", label: "Colors", enabled: true },
  { id: "types", label: "Types", enabled: false },
  { id: "spaces", label: "Spaces", enabled: false },
  { id: "details", label: "Details", enabled: false },
  { id: "designs", label: "Designs", enabled: false },
] as const;

export type DesignCategoryId = typeof DESIGN_CATEGORIES[number]["id"];

// Each source library has its own allowance. Designs will combine one of each.
export const SOURCE_LIBRARY_LIMITS = { colors: 4, types: 4, spaces: 4, details: 4 } as const;
