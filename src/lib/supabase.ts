import { createClient } from "@supabase/supabase-js";

// Note : projet Vite → les variables d'environnement utilisent le préfixe VITE_
// (pas NEXT_PUBLIC_). À définir dans .env.local ET dans Netlify :
//   VITE_SUPABASE_URL=...
//   VITE_SUPABASE_ANON_KEY=...  (la "anon key" / "publishable key")
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);
