// /middleware.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Middleware genérico: deja pasar todo.
// El control de rol y sesión lo hacen las páginas (AdminPage, CashierPage).
export function middleware(_req: NextRequest) {
  return NextResponse.next()
}

// Limita dónde corre el middleware.
// Acá solo se aplica en /admin y /cashier (y sus subrutas).
export const config = {
  matcher: [
    '/admin/:path*',
    '/cashier/:path*',
  ],
}
