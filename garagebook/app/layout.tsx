import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import ShellClient from '@/components/ShellClient';
import ToastContainer from '@/components/Toast';
import SwRegister from '@/components/SwRegister';
import { LangProvider } from '@/hooks/useLang';
const inter = Inter({ subsets: ['latin'], display: 'swap' });

export const metadata: Metadata = {
  title: 'Porwal Autoparts',
  description: 'Porwal Autoparts — Auto Parts Shop Manager',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={inter.className}>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#e94560" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Porwal" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="application-name" content="Porwal Autoparts" />
        <link rel="apple-touch-icon" href="/icon-192.svg" />
      </head>
      <body>
        <LangProvider>
          <ShellClient>{children}</ShellClient>
          <ToastContainer />
          <SwRegister />
        </LangProvider>
      </body>
    </html>
  );
}
