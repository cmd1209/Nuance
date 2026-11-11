import { useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";

/** A zero-height inline marker locates the rendered text's actual last baseline. */
export function ResizableTypeLine({children,label,className,size,min,max,active,fontStatus,fontWeight,onResize,onEdit}:{
  onEdit?:()=>void;children:string;label:string;className:string;size?:number;min:number;max:number;active:boolean;fontStatus:string;fontWeight?:number;onResize:(size:number)=>void;
}) {
  const text=useRef<HTMLParagraphElement>(null),marker=useRef<HTMLSpanElement>(null);
  const handle=useRef<HTMLDivElement>(null);
  const drag=useRef<{id:number;y:number;size:number}|null>(null);
  const [metrics,setMetrics]=useState({baseline:0,size:size??min});
  const [dragging,setDragging]=useState(false);
  function stop() {
    const id=drag.current?.id;
    drag.current=null;setDragging(false);
    if(id!==undefined && handle.current?.hasPointerCapture(id))handle.current.releasePointerCapture(id);
  }
  function measure() {
    const paragraph=text.current!,baseline=Math.round((marker.current!.getBoundingClientRect().top-paragraph.getBoundingClientRect().top)*100)/100;
    const fontSize=parseFloat(getComputedStyle(paragraph).fontSize);
    setMetrics(previous=>previous.baseline===baseline && previous.size===fontSize ? previous : {baseline,size:fontSize});
  }
  // Font loading can change the baseline without changing the paragraph's box.
  useLayoutEffect(()=>{if(active)measure();},[active,size,fontStatus,fontWeight,children]);
  useLayoutEffect(()=>{
    if(!active){stop();return;}
    measure();
    const observer=new ResizeObserver(measure);observer.observe(text.current!);
    window.addEventListener("blur",stop);
    return ()=>{observer.disconnect();window.removeEventListener("blur",stop);stop();};
  },[active]);
  const resize=(value:number)=>onResize(Math.round(Math.min(max,Math.max(min,value))));
  function start(event:PointerEvent<HTMLDivElement>) {
    if(event.button!==0 || !active)return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current={id:event.pointerId,y:event.clientY,size:parseFloat(getComputedStyle(text.current!).fontSize)};
    setDragging(true);
  }
  function move(event:PointerEvent<HTMLDivElement>) {
    const current=drag.current;
    if(current?.id===event.pointerId)resize(current.size+(event.clientY-current.y));
  }
  function keyResize(event:KeyboardEvent<HTMLDivElement>) {
    let next=metrics.size;
    if(event.key==="ArrowUp" || event.key==="ArrowRight")next+=event.shiftKey?8:1;
    else if(event.key==="ArrowDown" || event.key==="ArrowLeft")next-=event.shiftKey?8:1;
    else if(event.key==="Home")next=min;
    else if(event.key==="End")next=max;
    else return;
    event.preventDefault();resize(next);
  }
  return <div className={`type-line ${dragging?"is-resizing":""}`}>
    <p ref={text} onDoubleClick={onEdit} role={onEdit?"button":undefined} tabIndex={onEdit && active?0:undefined}
      onKeyDown={event=>{if(onEdit && (event.key==="Enter" || event.key===" ")){event.preventDefault();onEdit();}}} aria-label={onEdit?"Edit custom text":undefined} title={onEdit?"Double-click to edit text":undefined} className={className} style={size===undefined?undefined:{fontSize:`${size}px`}}>{children}<span ref={marker} className="type-line__baseline-marker" aria-hidden="true" /></p>
    <div ref={handle} className="type-line__handle" role="slider" tabIndex={active?0:-1}
      aria-label={`${label} size`} aria-orientation="vertical" aria-valuemin={min} aria-valuemax={max}
      aria-valuenow={Math.round(metrics.size)} aria-valuetext={`${Math.round(metrics.size)} pixels`}
      title={`Drag baseline to resize ${label.toLowerCase()}. Arrow keys adjust size; Shift for larger steps.`}
      style={{top:metrics.baseline}} onPointerDown={start} onPointerMove={move}
      onPointerUp={stop} onPointerCancel={stop} onLostPointerCapture={stop} onKeyDown={keyResize}>
      <span className="type-line__size" aria-hidden="true">{Math.round(metrics.size)} px</span>
    </div>
  </div>;
}
