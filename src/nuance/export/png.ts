import { type Composition } from "../domain/composition";
import { computeLayout, paintedRect } from "../domain/layout";

/** Export is an action, not persistence. Artwork has no dependency on UI theme, selection or React. */
export function drawComposition(context: CanvasRenderingContext2D, composition: Composition) {
  const { width, height } = composition.artwork;
  context.clearRect(0, 0, width, height);
  for (const region of computeLayout(composition.layout).regions) {
    const rect = paintedRect(region, composition.artwork);
    context.fillStyle = composition.colors.find(c => c.id === region.colorId)!.hex;
    const x = Math.round(rect.x * width), y = Math.round(rect.y * height);
    context.fillRect(x, y, Math.round((rect.x + rect.width) * width) - x, Math.round((rect.y + rect.height) * height) - y);
  }
}
export async function compositionPng(composition: Composition): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = composition.artwork.width; canvas.height = composition.artwork.height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Your browser could not create the PNG artwork.");
  drawComposition(context, composition);
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("PNG export failed. Please try again.")), "image/png"));
}
export async function downloadCompositionPng(composition: Composition) {
  const blob = await compositionPng(composition), url = URL.createObjectURL(blob);
  const link = document.createElement("a"); link.href = url;
  link.download = `nuance-${composition.colors.map(c => c.hex.slice(1).toLowerCase()).join("-")}.png`;
  document.body.appendChild(link); link.click(); link.remove();
  // Delay revocation so the browser can start the download, including Safari.
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
