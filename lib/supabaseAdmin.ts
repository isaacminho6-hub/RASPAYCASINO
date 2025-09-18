// /lib/supabaseAdmin.ts
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// ⚠️ NUNCA expongas esta key en el cliente.
// Debe estar en .env.local como SUPABASE_SERVICE_ROLE_KEY (sin NEXT_PUBLIC_)
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Seguridad básica: si alguien intenta importar esto en el browser, reventamos temprano
if (typeof window !== 'undefined') {
  throw new Error('supabaseAdmin sólo puede importarse/ejecutarse en el servidor.');
}

// Singleton para evitar múltiples instancias en dev
const globalForSupabaseAdmin = globalThis as unknown as { __sbAdmin?: SupabaseClient };

export const supabaseAdmin =
  globalForSupabaseAdmin.__sbAdmin ??
  createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false, // no hace falta en server
      autoRefreshToken: false,
    },
  });

if (!globalForSupabaseAdmin.__sbAdmin) {
  globalForSupabaseAdmin.__sbAdmin = supabaseAdmin;
}
