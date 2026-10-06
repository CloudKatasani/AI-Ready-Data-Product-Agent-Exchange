import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { DEFAULT_BRAND } from '@/lib/presenter/branding';
import './globals.css';

export const metadata: Metadata = {
  title: DEFAULT_BRAND.productName,
  description: 'Synthetic demo data',
};

const THEME_SCRIPT = "try{var m=window.matchMedia('(prefers-color-scheme: dark)');var a=function(){document.documentElement.classList.toggle('dark',m.matches)};a();m.addEventListener('change',a)}catch(e){}";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Follow the OS colour scheme before first paint (07 §2 dark tokens); no flash, no stored preference. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-screen bg-background text-foreground antialiased">{children}</body>
    </html>
  );
}
