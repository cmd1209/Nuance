import type { SupabaseClient } from "@supabase/supabase-js";

export const AVATAR_BUCKET = "avatars";
export const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
export const AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp"];

export function validateAvatarFile(file: Pick<File, "size" | "type">) {
  if (!file.size) throw new Error("Choose an image that is not empty.");
  if (file.size > MAX_AVATAR_BYTES) throw new Error("Choose an image up to 2 MB.");
  if (!AVATAR_TYPES.includes(file.type)) throw new Error("Choose a JPEG, PNG, or WebP image.");
}

export async function decodeAvatar(file: Blob) {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    if (!image.naturalWidth || !image.naturalHeight) throw new Error();
  } catch { throw new Error("This image could not be read. Choose another JPEG, PNG, or WebP."); }
  finally { URL.revokeObjectURL(url); }
}

export async function loadAvatar(client: SupabaseClient, owner: string) {
  const { data, error } = await client.storage.from(AVATAR_BUCKET).download(`${owner}/avatar`);
  if (error) {
    // Storage uses 400/404 for missing objects. Never hide permissions or network failures.
    if ("statusCode" in error && String(error.statusCode) === "404") return null;
    throw error;
  }
  await decodeAvatar(data);
  return data;
}
