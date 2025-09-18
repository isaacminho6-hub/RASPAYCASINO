// /lib/supabaseClient.ts
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// ⚠️ Estas variables deben estar en .env.local como NEXT_PUBLIC_*
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// En dev con Next hay HMR; usamos un singleton en globalThis para no crear múltiples clientes
const globalForSupabase = globalThis as unknown as { __sbClient?: SupabaseClient };

export const supabase =
  globalForSupabase.__sbClient ??
  createClient(url, anonKey, {
    auth: {
      persistSession: true,         // mantiene sesión en el navegador
      autoRefreshToken: true,       // refresca tokens automáticamente
      detectSessionInUrl: true,     // procesa fragments de magic links
    },
  });

if (!globalForSupabase.__sbClient) {
  globalForSupabase.__sbClient = supabase;
}
