import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "./client";
import { AVATAR_BUCKET, decodeAvatar, loadAvatar, validateAvatarFile } from "./avatar";
import { accountError } from "./errors";

export function useAvatar(owner: string | undefined) {
  const [image, setImage] = useState<{ owner: string; url: string } | null>(null);
  const [status, setStatus] = useState<{ owner: string; loading: boolean; error: string } | null>(null);
  const currentOwner = useRef(owner);
  currentOwner.current = owner;
  const generation = useRef(0);
  useEffect(() => () => { if (image) URL.revokeObjectURL(image.url); }, [image]);
  const reload = useCallback(async () => {
    const attempt = ++generation.current;
    if (!owner || !supabase) { setImage(null); setStatus(null); return; }
    setStatus({ owner, loading: true, error: "" });
    try {
      const blob = await loadAvatar(supabase, owner);
      if (generation.current !== attempt || currentOwner.current !== owner) return;
      setImage(blob ? { owner, url: URL.createObjectURL(blob) } : null);
      setStatus({ owner, loading: false, error: "" });
    } catch (error) {
      if (generation.current === attempt && currentOwner.current === owner) setStatus({ owner, loading: false, error: accountError(error) });
    }
  }, [owner]);
  useEffect(() => { void reload(); return () => { generation.current++; }; }, [reload]);

  async function upload(file: File) {
    if (!supabase || !owner || currentOwner.current !== owner) throw new Error("Please sign in first.");
    validateAvatarFile(file);
    const attempt = ++generation.current;
    await decodeAvatar(file);
    if (currentOwner.current !== owner || generation.current !== attempt) throw new Error("Your account changed. Please sign in again.");
    const { error } = await supabase.storage.from(AVATAR_BUCKET).upload(`${owner}/avatar`, file, { upsert: true, contentType: file.type, cacheControl: "0" });
    if (error) throw error;
    if (currentOwner.current !== owner || generation.current !== attempt) return;
    setImage({ owner, url: URL.createObjectURL(file) });
    setStatus({ owner, loading: false, error: "" });
  }
  async function remove() {
    if (!supabase || !owner || currentOwner.current !== owner) throw new Error("Please sign in first.");
    const attempt = ++generation.current;
    const { error } = await supabase.storage.from(AVATAR_BUCKET).remove([`${owner}/avatar`]);
    if (error) throw error;
    if (currentOwner.current !== owner || generation.current !== attempt) return;
    setImage(null); setStatus({ owner, loading: false, error: "" });
  }
  return { url: image?.owner === owner ? image?.url : undefined,
    loading: status?.owner === owner && !!status?.loading,
    error: status?.owner === owner ? status?.error ?? "" : "", reload, upload, remove };
}
