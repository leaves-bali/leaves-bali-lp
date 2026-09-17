import type { Metadata } from 'next';

import './globals.css';

export const metadata: Metadata = {
  title: 'Hoshi Jungle Review AI',
  description:
    'Draft replies for Hoshi Jungle Google reviews in the guest\u2019s own language. Staff approve before anything is published.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
