import type { SupabaseClient } from "@supabase/supabase-js";
import type { Composition } from "../domain/composition";
import { deserializeComposition, serializeComposition } from "../domain/serialization";

export interface Profile { id: string; display_name: string }
export interface SavedComposition { id: string; updatedAt: string; composition: Composition }

export function readSavedComposition(row: { id: string; document: unknown; updated_at: string }): SavedComposition {
  const composition = deserializeComposition(JSON.stringify(row.document));
  if (composition.id !== row.id || !Number.isFinite(Date.parse(row.updated_at))) throw new Error("This saved composition could not be read.");
  return { id: row.id, updatedAt: row.updated_at, composition };
}

export async function loadProfile(client: SupabaseClient, owner: string): Promise<Profile | null> {
  const { data, error } = await client.from("profiles").select("id, display_name").eq("id", owner).maybeSingle();
  if (error) throw error;
  return data;
}

export async function saveProfile(client: SupabaseClient, owner: string, name: string): Promise<Profile> {
  const displayName = name.trim();
  if (displayName.length > 80) throw new Error("Use a display name with 80 characters or fewer.");
  const { data, error } = await client.from("profiles").upsert({ id: owner, display_name: displayName }).select("id, display_name").single();
  if (error) throw error;
  return data;
}

export async function loadCompositions(client: SupabaseClient, owner: string): Promise<SavedComposition[]> {
  // Page through the library instead of relying on the project's row limit.
  const result: SavedComposition[] = [];
  for (let offset = 0; ; offset += 100) {
    const { data, error } = await client.from("compositions").select("id, document, updated_at").eq("owner_id", owner)
      .order("updated_at", { ascending: false }).order("id").range(offset, offset + 99);
    if (error) throw error;
    result.push(...data.map(readSavedComposition));
    if (data.length < 100) return result;
  }
}

export async function saveComposition(client: SupabaseClient, owner: string, composition: Composition): Promise<SavedComposition> {
  const document = deserializeComposition(serializeComposition(composition));
  const { data, error } = await client.from("compositions").upsert({ id: document.id, owner_id: owner, document }, { onConflict: "owner_id,id" })
    .select("id, document, updated_at").single();
  if (error) throw error;
  return readSavedComposition(data);
}
