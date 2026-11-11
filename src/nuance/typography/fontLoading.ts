import type { Typeface } from "../domain/typefaces";
export type FontLoadStatus = "idle" | "loading" | "loaded" | "unavailable";
const requests = new Map<string,Promise<FontLoadStatus>>();

/** Load variable families once and static weights only when selected. */
export function loadSpecimenFont(font:Typeface,weight=font.loading.specimenWeight):Promise<FontLoadStatus> {
  const additionalFace=font.loading.additionalFaces?.find(face=>face.weight===weight);
  const url=additionalFace?.url??font.loading.url;
  const key=`${font.id}:${font.upstream.packageVersion}:${url}`;
  const existing=requests.get(key);
  if(existing)return existing;
  const request=(async ():Promise<FontLoadStatus> => {
    if(typeof FontFace === "undefined" || typeof document === "undefined" || !document.fonts)return "unavailable";
    let timeout:ReturnType<typeof setTimeout>|undefined;
    try {
      const face=new FontFace(font.loading.family,`url("${url}") format("woff2")`,{
        weight:additionalFace?String(additionalFace.weight):font.loading.weight,style:font.loading.style,display:font.loading.display,
      });
      await Promise.race([face.load(),new Promise<never>((_,reject)=>{timeout=setTimeout(()=>reject(new Error("Font load timed out")),12000);})]);
      document.fonts.add(face);
      return "loaded";
    } catch { return "unavailable"; }
    finally { if(timeout!==undefined)clearTimeout(timeout); }
  })();
  requests.set(key,request);
  return request;
}
