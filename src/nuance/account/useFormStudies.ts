import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "./client";
import { accountError } from "./errors";
import { deleteFormStudy, loadFormStudies, saveFormStudy } from "./formStudyRepository";
import { MAX_SAVED_FORM_CONFIGURATIONS } from "../domain/form";
import type { SavedFormStudy, SizingStudy } from "../domain/formStudies";

/** Form loading and mutations stay independent of the Color and Type account paths. */
export function useFormStudies(userId: string | undefined) {
  const owner = useRef(userId);
  owner.current = userId;
  const generation = useRef(0);
  const operation = useRef<symbol | null>(null);
  const [data, setData] = useState<{ owner: string; saved: SavedFormStudy[] } | null>(null);
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<{ owner: string | undefined; message: string }>({ owner: undefined, message: "" });
  const error = failure.owner === userId ? failure.message : "";
  const saved = data && data.owner === userId ? data.saved : [];

  const refresh = useCallback(async () => {
    const current = ++generation.current;
    if (!supabase || !userId) { setData(null); setPending(false); return; }
    setPending(true);
    setFailure({ owner: userId, message: "" });
    try {
      const records = await loadFormStudies(supabase, userId);
      if (owner.current === userId && current === generation.current) setData({ owner: userId, saved: records });
    } catch (error) {
      if (owner.current === userId && current === generation.current) setFailure({ owner: userId, message: accountError(error) });
    } finally {
      if (current === generation.current) setPending(false);
    }
  }, [userId]);
  useEffect(() => { operation.current = null; void refresh(); return () => { generation.current++; }; }, [refresh]);

  async function mutate<T>(action: () => Promise<T>, update: (saved: SavedFormStudy[], result: T) => SavedFormStudy[]): Promise<T> {
    if (!supabase || !userId || owner.current !== userId) throw new Error("Please sign in to save Form studies.");
    if (operation.current) throw new Error("Please wait for the current save to finish.");
    const marker = Symbol();
    operation.current = marker;
    try {
      const result = await action();
      if (owner.current !== userId || operation.current !== marker) throw new Error("Your account changed. Please try again.");
      generation.current++;
      setPending(false);
      setFailure({ owner: userId, message: "" });
      setData(previous => ({ owner: userId, saved: update(previous?.owner === userId ? previous.saved : [], result) }));
      return result;
    } catch (error) {
      // Another tab may have filled a slot or removed the chosen replacement.
      if (owner.current === userId && operation.current === marker) await refresh();
      throw error;
    } finally {
      if (operation.current === marker) operation.current = null;
    }
  }

  async function save(document: SizingStudy) {
    const updating = saved.some(item => item.document.id === document.id && item.document.setting === document.setting);
    if (!updating && saved.filter(item => item.document.setting === document.setting).length >= MAX_SAVED_FORM_CONFIGURATIONS) {
      throw new Error("All three slots are in use. Choose a study to replace.");
    }
    return mutate(() => saveFormStudy(supabase!, userId!, document, updating),
      (previous, result) => [result, ...previous.filter(item => item.document.id !== result.document.id)]);
  }
  async function remove(id: string) {
    return mutate(() => deleteFormStudy(supabase!, userId!, id), previous => previous.filter(item => item.document.id !== id));
  }
  return { saved, error, refresh, save, remove,
    loading: !!userId && (pending || (data?.owner !== userId && !error)) };
}
export type FormStudies = ReturnType<typeof useFormStudies>;
