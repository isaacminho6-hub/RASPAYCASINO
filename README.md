# RasPay

Raspadita con Next.js 14 + Supabase.

## Arranque
1. `cp .env.local.example .env.local` y completa tus claves
2. En Supabase ejecutá `supabase/schema.sql`
3. `npm install`
4. `npm run dev` → http://localhost:3000

## Rutas
- `/` Home
- `/login` Login usuario/contraseña (si usas sólo `usuario`, el email será `usuario@local.raspay`)
- `/game` Juego de raspadita
- `/admin` y `/cashier` Paneles (UI mínima; endpoints incluidos)
