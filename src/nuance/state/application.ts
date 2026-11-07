import type { DesignCategoryId } from "../domain/categories";

/** Global navigation and presentation; creative work lives in section-owned state. */
export interface ApplicationState {
  activeSection: DesignCategoryId;
  theme: "light" | "dark";
}

export type ApplicationAction = { type: "navigate"; section: DesignCategoryId } | { type: "theme" };

export function createApplicationState(): ApplicationState {
  return { activeSection: "colors", theme: "dark" };
}

export function applicationReducer(state: ApplicationState, action: ApplicationAction): ApplicationState {
  return action.type === "navigate" ? { ...state, activeSection: action.section }
    : { ...state, theme: state.theme === "dark" ? "light" : "dark" };
}
