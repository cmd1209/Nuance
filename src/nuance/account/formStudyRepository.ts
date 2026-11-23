import type { SupabaseClient } from "@supabase/supabase-js";
import { readFormStudy, type SavedFormStudy, type SizingStudy } from "../domain/formStudies";

const COLUMNS = "id,setting,document,updated_at";
export function readSavedFormStudy(row: { id: unknown; setting: unknown; document: unknown; updated_at: unknown }): SavedFormStudy {
  const document = readFormStudy(row.document);
  if (row.id !== document.id || row.setting !== document.setting || typeof row.updated_at !== "string" || !Number.isFinite(Date.parse(row.updated_at))) {
    throw new Error("This saved Form study could not be read.");
  }
  return { document, updatedAt: row.updated_at };
}

export async function loadFormStudies(client: SupabaseClient, owner: string): Promise<SavedFormStudy[]> {
  const { data, error } = await client.from("form_studies").select(COLUMNS).eq("owner_id", owner).order("updated_at", { ascending: false }).order("id");
  if (error) throw error;
  return data.map(readSavedFormStudy);
}

export async function saveFormStudy(client: SupabaseClient, owner: string, study: SizingStudy, updating: boolean): Promise<SavedFormStudy> {
  const document = readFormStudy(study);
  const query = updating
    ? client.from("form_studies").update({ document }).eq("owner_id", owner).eq("id", document.id).eq("setting", document.setting)
    : client.from("form_studies").insert({ owner_id: owner, id: document.id, setting: document.setting, document });
  const { data, error } = await query.select(COLUMNS).single();
  if (error) throw error;
  return readSavedFormStudy(data);
}

export async function deleteFormStudy(client: SupabaseClient, owner: string, id: string): Promise<void> {
  const { error } = await client.from("form_studies").delete().eq("owner_id", owner).eq("id", id);
  if (error) throw error;
}
