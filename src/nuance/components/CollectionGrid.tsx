import type { ReactNode } from "react";

/** Shared responsive layout for Explore and Saved across creative sections. */
export function CollectionGrid<T extends { id: string }>({ items, renderItem, label, className = "", itemClassName = "" }: {
  items: readonly T[];
  renderItem: (item: T, index: number) => ReactNode;
  label?: string;
  className?: string;
  itemClassName?: string;
}) {
  return <div className={`collection-grid ${className}`.trim()} aria-label={label}>
    {items.map((item, index) => <article key={`${index}:${item.id}`} className={`collection-grid__item ${itemClassName}`.trim()}>{renderItem(item, index)}</article>)}
  </div>;
}
