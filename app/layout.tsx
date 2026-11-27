import './globals.css';
import type { Metadata } from 'next';
import { Manrope, Playfair_Display } from 'next/font/google';
import { AuthProvider } from '@/lib/auth-context';
import { AppAccessBoundary } from '@/components/auth/app-access-boundary';
import { ThemeProvider } from '@/components/theme-provider';
import { PwaRegistrar } from '@/components/pwa-registrar';

const manrope = Manrope({ subsets: ['latin'], variable: '--font-manrope' });
const playfair = Playfair_Display({ subsets: ['latin'], variable: '--font-playfair' });

export const metadata: Metadata = {
  title: {
    default: 'ARAS - Des Rencontres qui ont du sens',
    template: '%s | ARAS - Des Rencontres qui ont du sens',
  },
  description: 'La plateforme de rencontres sérieuses inspirée par les valeurs de la Téranga.',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [{ url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }, { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' }],
    shortcut: '/icons/icon-192.png',
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  appleWebApp: { capable: true, title: 'ARAS', statusBarStyle: 'default' },
  themeColor: '#ec3b78',
  viewport: { width: 'device-width', initialScale: 1, viewportFit: 'cover' },
};

export const dynamic = 'force-dynamic';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body className={`${manrope.variable} ${playfair.variable}`}>
        <ThemeProvider>
          <PwaRegistrar />
          <AuthProvider>
            <AppAccessBoundary>{children}</AppAccessBoundary>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
