import { createClient } from "@supabase/supabase-js";
import { readAuthReturn } from "./emailAuth";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
// Capture callback intent before the SDK consumes the URL fragment.
export const authReturn = readAuthReturn(window.location.href);

// Only a browser-safe publishable key belongs in Vite's public environment.
export const supabase = url && key ? createClient(url, key, { auth: { flowType: "implicit", detectSessionInUrl: true } }) : null;
