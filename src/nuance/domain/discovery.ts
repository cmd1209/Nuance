import type { Composition } from "./composition";
import type { PaletteCollection } from "./collections";
export interface DiscoveryCursor { queues:Record<string,string[]>; turn:number }
export const DISCOVERY_BATCH_SIZE=60;
export const createDiscoveryCursor=():DiscoveryCursor=>({queues:{},turn:0});
function shuffle<T>(values:readonly T[],random:()=>number):T[] {
  const result=[...values];
  for(let i=result.length-1;i>0;i--){const j=Math.min(i,Math.max(0,Math.floor(random()*(i+1))));[result[i],result[j]]=[result[j],result[i]];}
  return result;
}
/** Round-robin exposure; independent cycles exhaust before refill, regardless of catalog size. */
export function discoverBatch(collections:readonly PaletteCollection[],cursor:DiscoveryCursor,size=DISCOVERY_BATCH_SIZE,random=Math.random):{palettes:Composition[];cursor:DiscoveryCursor} {
  if(!Number.isSafeInteger(size)||size<0)throw new Error("Invalid discovery batch size.");
  const active=collections.filter(collection=>collection.palettes.length>0);
  if(new Set(active.map(collection=>collection.id)).size!==active.length)throw new Error("Duplicate collection ID.");
  const entries=active.flatMap(collection=>collection.palettes);
  if(new Set(entries.map(entry=>entry.id)).size!==entries.length)throw new Error("Palette IDs must be globally unique.");
  const queues=Object.fromEntries(active.map(collection=>[collection.id,[...(cursor.queues[collection.id]??[])]]));
  const selected=new Set<string>(),palettes:Composition[]=[];
  let turn=active.length?cursor.turn%active.length:0,misses=0;
  while(palettes.length<Math.min(size,entries.length)&&misses<active.length){
    const collection=active[turn];turn=(turn+1)%active.length;
    let queue=queues[collection.id];
    if(!queue.length)queue=queues[collection.id]=shuffle(collection.palettes.map(palette=>palette.id),random);
    const index=queue.findIndex(id=>!selected.has(id));
    if(index<0){misses++;continue;}
    const [id]=queue.splice(index,1),entry=collection.palettes.find(palette=>palette.id===id);
    if(!entry)throw new Error(`Unknown palette in discovery cycle: ${id}`);
    selected.add(id);palettes.push(entry.create());misses=0;
  }
  return {palettes,cursor:{queues,turn}};
}
