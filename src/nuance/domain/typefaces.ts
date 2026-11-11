import rawRegistry from "../data/typefaces/v1/registry.json";

export const TYPEFACE_REGISTRY_VERSION = 1 as const;
export type TypefaceClassification = "serif" | "sans-serif" | "monospace" | "display";
export const TYPEFACE_CLASSIFICATION_LABELS:Readonly<Record<TypefaceClassification,string>> = {
  serif:"Serif", "sans-serif":"Sans-serif", monospace:"Monospace", display:"Display",
};
export interface Typeface {
  readonly id: string;
  readonly family: string;
  readonly classification: TypefaceClassification;
  readonly source: "google-fonts";
  readonly sourceLabel: string;
  readonly availableWeights: readonly number[];
  readonly availableStyles: readonly string[];
  readonly variable: boolean;
  readonly supportedSubsets: readonly string[];
  readonly license: Readonly<{ spdx:string; url:string; attribution:string; noticeUrl:string }>;
  readonly loading: Readonly<{ family:string; url:string; format:"woff2"; subset:"latin"; style:"normal"; weight:string; display:"swap"; specimenWeight:number;
    additionalFaces?:readonly Readonly<{weight:number;url:string;assetUrl:string;sha256:string;bytes:number}>[] }>;
  readonly upstream: Readonly<{ package:string; packageVersion:string; fontVersion:string; assetUrl:string; metadataUrl:string; licenseUrl:string; sha256:string; bytes:number }>;
}
function freeze<T>(value:T):T {
  if(value && typeof value === "object") { Object.values(value).forEach(freeze);Object.freeze(value); }
  return value;
}
export const TYPEFACES: readonly Typeface[] = freeze(rawRegistry as Typeface[]);
export function typefaceById(id:string):Typeface {
  const font=TYPEFACES.find(font=>font.id===id);
  if(!font)throw new Error(`Unknown typeface: ${id}`);
  return font;
}
export const typefaceFallback = (font:Typeface):string => font.classification === "serif" ? 'Georgia, "Times New Roman", serif'
  : font.classification === "monospace" ? '"Courier New", Courier, monospace' : 'Arial, Helvetica, sans-serif';
export const typefaceFamily = (font:Typeface):string => `"${font.loading.family}", ${typefaceFallback(font)}`;

/** Favorites reference immutable, versioned metadata instead of copying font binaries. */
export interface TypefaceSelection {
  readonly fontId:string;
  readonly source:Typeface["source"];
  readonly registryVersion:typeof TYPEFACE_REGISTRY_VERSION;
  readonly fontWeight?:number;
  readonly alphabet?:boolean;
  readonly custom?:boolean;
  readonly customText?:string;
}
export function selectTypeface(id:string):TypefaceSelection {
  const font=typefaceById(id);
  return {fontId:font.id,source:font.source,registryVersion:TYPEFACE_REGISTRY_VERSION};
}
