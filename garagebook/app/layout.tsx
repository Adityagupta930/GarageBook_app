import type { Metadata } from 'next';
import './globals.css';
import Navbar from '@/components/Navbar';
import ToastContainer from '@/components/Toast';
import { initDb } from '@/lib/db';

export const metadata: Metadata = {
  title: 'GarageBook — Auto Parts Shop',
  description: 'Auto parts dukaan manager — inventory, sales, credit, billing',
};

// Ensure tables exist on every cold start
initDb().catch(console.error);

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-100 min-h-screen text-gray-800">
        <Navbar />
        <ToastContainer />
        <main className="max-w-5xl mx-auto p-4 md:p-6">{children}</main>
      </body>
    </html>
  );
}
