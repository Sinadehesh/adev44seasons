import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'adev44seasons',
  description: 'A lightweight background productivity companion.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-neutral-950 text-neutral-50 antialiased">
        {children}
      </body>
    </html>
  );
}
