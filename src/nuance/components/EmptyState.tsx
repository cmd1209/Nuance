import type { ReactNode } from "react";

export function EmptyState({ message, action }: { message: string; action?: ReactNode }) {
  return <div className="section-empty-state">
    <p>{message}</p>
    {action}
  </div>;
}
