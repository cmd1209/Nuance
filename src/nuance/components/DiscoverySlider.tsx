import { Fragment, useLayoutEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "./Button";

export function DiscoverySlider<T extends {id:string}>({ items, activeId, activeIndex, renderItem, onPositionChange, onRequestMore, label, itemLabel, navigationLabel, scrollLabel, previousLabel, nextLabel }: {
  items: readonly T[];
  activeId: string | null;
  activeIndex?: number;
  renderItem: (item:T,index:number)=>ReactNode;
  onPositionChange?: (itemId:string,index:number)=>void;
  onRequestMore?: ()=>void;
  label:string;
  itemLabel:string;
  navigationLabel:string;
  scrollLabel:string;
  previousLabel:string;
  nextLabel:string;
}) {
  const viewport = useRef<HTMLDivElement>(null);
  const id = useId();
  const [pageSize, setPageSize] = useState(3);
  const firstVisible = useRef(activeIndex ?? Math.max(0, items.findIndex(palette => palette.id === activeId)));
  const requestedLength = useRef(0);
  const [bounds, setBounds] = useState({ previous: false, next: false, overflowing: false });
  const pages = Array.from({ length: Math.ceil(items.length / pageSize) }, (_, index) => items.slice(index * pageSize, (index + 1) * pageSize));

  useLayoutEffect(() => {
    if (activeIndex !== undefined) firstVisible.current = activeIndex;
  }, [activeIndex]);

  useLayoutEffect(() => {
    const element = viewport.current!;
    const measure = () => setPageSize(Number(getComputedStyle(element).getPropertyValue("--palette-columns")) || 3);
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    measure();
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    const element = viewport.current!;
    let needsRestore = true;
    const restore = () => {
      if (!element.clientWidth) return;
      const step = element.clientWidth + parseFloat(getComputedStyle(element).columnGap);
      element.scrollTo({ left: Math.floor(firstVisible.current / pageSize) * step, behavior: "instant" });
      needsRestore = false;
    };
    restore();
    const update = () => {
      // A hidden main section has no measurable width; keep its remembered page.
      if (!element.clientWidth) { needsRestore = true; return; }
      if (needsRestore) restore();
      const maximum = element.scrollWidth - element.clientWidth;
      const currentStep = element.clientWidth + parseFloat(getComputedStyle(element).columnGap);
      firstVisible.current = Math.round(element.scrollLeft / currentStep) * pageSize;
      const first = items[firstVisible.current];
      if (first) onPositionChange?.(first.id, firstVisible.current);
      setBounds({ previous: element.scrollLeft > 1, next: element.scrollLeft < maximum - 1, overflowing: maximum > 1 });
      // Extend the same carousel before its final page; no extra discovery control.
      if (onRequestMore && maximum > 1 && element.scrollLeft >= maximum - currentStep - 1 && requestedLength.current !== items.length) {
        requestedLength.current = items.length;
        onRequestMore();
      }
    };
    // Recalculate bounds as the viewport changes, even within the same breakpoint.
    const observer = new ResizeObserver(update);
    observer.observe(element);
    element.addEventListener("scroll", update, { passive: true });
    update();
    return () => {
      observer.disconnect();
      element.removeEventListener("scroll", update);
    };
  }, [items, pageSize, onPositionChange, onRequestMore]);

  function move(direction: -1 | 1) {
    const element = viewport.current!;
    const slides = element.children;
    if (slides.length < 2) return;
    const step = slides[1].getBoundingClientRect().left - slides[0].getBoundingClientRect().left;
    const index = Math.max(0, Math.min(slides.length - 1, Math.round(element.scrollLeft / step) + direction));
    const behavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth";
    element.scrollTo({ left: index * step, behavior });
  }

  function navigate(event: KeyboardEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget || event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      move(event.key === "ArrowLeft" ? -1 : 1);
    }
  }

  return <div className="palette-slider" role="region" aria-roledescription="carousel" aria-label={label}>
    <div ref={viewport} id={id} className="palette-slider__viewport" role="group" tabIndex={0} aria-label={scrollLabel} onKeyDown={navigate}>
      {pages.map((page, index) => <div key={index} className="palette-slider__page" role="group" aria-roledescription="slide" aria-label={`${itemLabel} ${index * pageSize + 1} to ${Math.min((index + 1) * pageSize, items.length)} of ${items.length}`}>
        {page.map((item, offset) => <Fragment key={`${index * pageSize + offset}:${item.id}`}>{renderItem(item, index * pageSize + offset)}</Fragment>)}
      </div>)}
    </div>
    {bounds.overflowing && <div className="palette-slider__navigation" role="group" aria-label={navigationLabel}>
      <Button className="palette-slider__arrow" aria-label={previousLabel} aria-controls={id} disabled={!bounds.previous} onClick={() => move(-1)}>
        <ChevronLeft size={20} strokeWidth={1.5} aria-hidden="true" />
      </Button>
      <Button className="palette-slider__arrow" aria-label={nextLabel} aria-controls={id} disabled={!bounds.next} onClick={() => move(1)}>
        <ChevronRight size={20} strokeWidth={1.5} aria-hidden="true" />
      </Button>
    </div>}
  </div>;
}
