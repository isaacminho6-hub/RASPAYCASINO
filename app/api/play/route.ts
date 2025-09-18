import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    // podés leer el body si querés: const body = await req.json();
    // Respuesta mínima para que el juego no rompa:
    return NextResponse.json({
      prize: { label: '💸 ₲0' },
      payout: 0,
      jackpot: 2_000_000,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Error' }, { status: 500 });
  }
}
