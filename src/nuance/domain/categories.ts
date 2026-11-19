export const DESIGN_CATEGORIES = [
  { id: "colors", label: "Color", enabled: true },
  { id: "types", label: "Type", enabled: true },
  { id: "form", label: "Form", enabled: true },
  { id: "designs", label: "Design", enabled: true },
] as const;

export type DesignCategoryId = typeof DESIGN_CATEGORIES[number]["id"];
export type FoundationSectionId = Exclude<DesignCategoryId, "colors" | "designs">;

// Each source library has its own allowance. Designs will combine one of each.
export const SOURCE_LIBRARY_LIMITS = { colors: 8, types: 8, form: 4 } as const;
