import type { Metadata } from 'next';
import './globals.css';
import ShellClient from '@/components/ShellClient';
import ToastContainer from '@/components/Toast';
import { initDb } from '@/lib/db';

export const metadata: Metadata = {
  title: 'GarageBook — Auto Parts Shop',
  description: 'Auto parts dukaan manager',
};

initDb().catch(console.error);

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ShellClient>{children}</ShellClient>
        <ToastContainer />
      </body>
    </html>
  );
}
