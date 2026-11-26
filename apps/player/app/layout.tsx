import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'MixLab: free music, with ads',
  description: 'A demo music player that A/B tests how often to play ads, with Flagsmith Experimentation.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
