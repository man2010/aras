import './globals.css';
import type { Metadata } from 'next';
import { Manrope, Playfair_Display } from 'next/font/google';
import { AuthProvider } from '@/lib/auth-context';
import { Navbar, Footer } from '@/components/navigation';
import { PersistentVideo } from '@/components/persistent-video';

const manrope = Manrope({ subsets: ['latin'], variable: '--font-manrope' });
const playfair = Playfair_Display({ subsets: ['latin'], variable: '--font-playfair' });

export const metadata: Metadata = {
  title: 'ARAS — Des rencontres qui ont du sens',
  description: 'La plateforme de rencontres sérieuses inspirée par les valeurs de la Téranga.',
};

export const dynamic = 'force-dynamic';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className={`${manrope.variable} ${playfair.variable}`}>
        <AuthProvider>
          <Navbar />
          {children}
          <Footer />
          <PersistentVideo />
        </AuthProvider>
      </body>
    </html>
  );
}
