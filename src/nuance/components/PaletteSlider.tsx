import type { Composition } from "../domain/composition";
import { DiscoverySlider } from "./DiscoverySlider";
import { PaletteCard } from "./PaletteCard";

/** Color-specific rendering; paging, scroll and focus behavior are shared with Types. */
export function PaletteSlider({palettes,activeId,activeIndex,onSelect,onPositionChange,onRequestMore}:{
  palettes:Composition[];
  activeId:string|null;
  activeIndex?:number;
  onSelect:(palette:Composition,index:number)=>void;
  onPositionChange?:(paletteId:string,index:number)=>void;
  onRequestMore?:()=>void;
}) {
  return <DiscoverySlider items={palettes} activeId={activeId} activeIndex={activeIndex} onPositionChange={onPositionChange} onRequestMore={onRequestMore}
    label="Color palettes" itemLabel="Palettes" navigationLabel="Palette navigation" scrollLabel="Scroll palettes with left and right arrow keys" previousLabel="Previous palettes" nextLabel="Next palettes"
    renderItem={(palette,index)=><PaletteCard occurrence={index} composition={palette} showName onSelect={()=>onSelect(palette,index)} />} />;
}
