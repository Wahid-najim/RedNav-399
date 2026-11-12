import type { Metadata } from 'next';
// @ts-ignore -- CSS is handled by the Next.js bundler.
import './globals.css';

export const metadata: Metadata = {
  title: 'RedNav-N399 | Planetary Surface Navigation & Telemetry Module',
  description:
    'Layered NASA-data Mars map and Marswalk route planner with a helmet HUD.',
  openGraph: {
    title: 'RedNav-N399 | Planetary Surface Navigation & Telemetry Module',
    description:
      'Layered NASA-data Mars map and Marswalk route planner with a helmet HUD.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link
          rel="icon"
          href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Ccircle cx='16' cy='16' r='14' fill='%23120608' stroke='%23FF3B30' stroke-width='3'/%3E%3Ccircle cx='16' cy='16' r='5' fill='%23E5484D'/%3E%3C/svg%3E"
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Chakra+Petch:ital,wght@0,400;0,500;0,600;0,700;1,400;1,600&family=Orbitron:wght@500;700;800;900&family=JetBrains+Mono:wght@400;500;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-[#060408] text-slate-100 antialiased overflow-hidden select-none">
        {children}
      </body>
    </html>
  );
}