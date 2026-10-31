import './globals.css';
import type { Metadata } from 'next';
import { Manrope, Playfair_Display } from 'next/font/google';
import { AuthProvider } from '@/lib/auth-context';
import { AppAccessBoundary } from '@/components/auth/app-access-boundary';
import { ThemeProvider } from '@/components/theme-provider';

const manrope = Manrope({ subsets: ['latin'], variable: '--font-manrope' });
const playfair = Playfair_Display({ subsets: ['latin'], variable: '--font-playfair' });

export const metadata: Metadata = {
  title: {
    default: 'ARAS - Des Rencontres qui ont du sens',
    template: '%s | ARAS - Des Rencontres qui ont du sens',
  },
  description: 'La plateforme de rencontres sérieuses inspirée par les valeurs de la Téranga.',
  icons: {
    icon: '/aras-logo.jpeg',
    shortcut: '/aras-logo.jpeg',
    apple: '/aras-logo.jpeg',
  },
};

export const dynamic = 'force-dynamic';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body className={`${manrope.variable} ${playfair.variable}`}>
        <ThemeProvider>
          <AuthProvider>
            <AppAccessBoundary>{children}</AppAccessBoundary>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
