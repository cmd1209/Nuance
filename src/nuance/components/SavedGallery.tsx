import type { ReactNode } from "react";
import { CollectionGrid } from "./CollectionGrid";

/** Shared layout for section libraries; each section supplies its own preview and actions. */
export function SavedGallery<T extends { id: string }>({ items, maximum, renderItem, empty }: {
  items: T[]; maximum: number; renderItem: (item: T) => ReactNode; empty: ReactNode;
}) {
  return <div className="saved-gallery">
    <p className="saved-gallery__count" role="status">{items.length} / {maximum} saved</p>
    {items.length ? <CollectionGrid items={items} renderItem={renderItem} className="saved-gallery__grid" itemClassName="saved-gallery__item" /> : empty}
  </div>;
}
