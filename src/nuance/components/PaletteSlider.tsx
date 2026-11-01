import { useLayoutEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Composition } from "../domain/composition";
import { Button } from "./Button";
import { PaletteCard } from "./PaletteCard";

export function PaletteSlider({ palettes, activeId, onSelect }: {
  palettes: Composition[];
  activeId: string | null;
  onSelect: (palette: Composition) => void;
}) {
  const viewport = useRef<HTMLDivElement>(null);
  const id = useId();
  const [pageSize, setPageSize] = useState(3);
  const firstVisible = useRef(Math.max(0, palettes.findIndex(palette => palette.id === activeId)));
  const [bounds, setBounds] = useState({ previous: false, next: false, overflowing: false });
  const pages = Array.from({ length: Math.ceil(palettes.length / pageSize) }, (_, index) => palettes.slice(index * pageSize, (index + 1) * pageSize));

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
    const step = element.clientWidth + parseFloat(getComputedStyle(element).columnGap);
    element.scrollTo({ left: Math.floor(firstVisible.current / pageSize) * step, behavior: "instant" });
    const update = () => {
      const maximum = element.scrollWidth - element.clientWidth;
      const currentStep = element.clientWidth + parseFloat(getComputedStyle(element).columnGap);
      firstVisible.current = Math.round(element.scrollLeft / currentStep) * pageSize;
      setBounds({ previous: element.scrollLeft > 1, next: element.scrollLeft < maximum - 1, overflowing: maximum > 1 });
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
  }, [palettes, pageSize]);

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

  return <div className="palette-slider" role="region" aria-roledescription="carousel" aria-label="Color palettes">
    <div ref={viewport} id={id} className="palette-slider__viewport" role="group" tabIndex={0} aria-label="Scroll palettes with left and right arrow keys" onKeyDown={navigate}>
      {pages.map((page, index) => <div key={page[0].id} className="palette-slider__page" role="group" aria-roledescription="slide" aria-label={`Palettes ${index * pageSize + 1} to ${Math.min((index + 1) * pageSize, palettes.length)} of ${palettes.length}`}>
        {page.map(palette => <PaletteCard key={palette.id} composition={palette} highlighted={activeId === palette.id} onSelect={() => onSelect(palette)} />)}
      </div>)}
    </div>
    {bounds.overflowing && <div className="palette-slider__navigation" role="group" aria-label="Palette navigation">
      <Button className="palette-slider__arrow" aria-label="Previous palettes" aria-controls={id} disabled={!bounds.previous} onClick={() => move(-1)}>
        <ChevronLeft size={20} strokeWidth={1.5} aria-hidden="true" />
      </Button>
      <Button className="palette-slider__arrow" aria-label="Next palettes" aria-controls={id} disabled={!bounds.next} onClick={() => move(1)}>
        <ChevronRight size={20} strokeWidth={1.5} aria-hidden="true" />
      </Button>
    </div>}
  </div>;
}
