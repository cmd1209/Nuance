export function accountError(error: unknown): string {
  return error instanceof Error ? error.message : typeof error === "object" && error !== null && "message" in error ? String(error.message) : "Something went wrong. Please try again.";
}

