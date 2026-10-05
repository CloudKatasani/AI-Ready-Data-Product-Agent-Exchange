import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { DEFAULT_BRAND } from '@/lib/presenter/branding';
import './globals.css';

export const metadata: Metadata = {
  title: DEFAULT_BRAND.productName,
  description: 'Synthetic demo data',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
