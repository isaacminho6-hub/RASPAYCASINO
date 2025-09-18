import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'RasPay — Rascá y ganá al instante',
  description: 'Raspadita online en modo DEMO o con saldo real. Tickets desde Gs. 5.000. Pagos verificados y jackpot que crece con cada jugada.',
  metadataBase: new URL('https://raspay.example'), // ← cambia al dominio real
  openGraph: {
    title: 'RasPay — Rascá y ganá al instante',
    description: 'Proba gratis en modo DEMO. Tickets desde Gs. 5.000.',
    type: 'website',
    url: 'https://raspay.example',
  },
  themeColor: '#0E0A1F',
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
    viewportFit: 'cover',
  },
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <head>
        {/* Fuentes */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;800;900&display=swap"
          rel="stylesheet"
        />

        {/* Perf: conexiones tempranas (ajusta dominios reales) */}
        <link rel="preconnect" href="https://api.supabase.io" crossOrigin="" />
        <link rel="preconnect" href="https://*.supabase.co" crossOrigin="" />

        {/* Manifest / PWA opcional */}
        <link rel="manifest" href="/manifest.webmanifest" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body>{children}</body>
    </html>
  );
}
