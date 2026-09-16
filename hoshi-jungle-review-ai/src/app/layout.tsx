import type { Metadata } from 'next';

import './globals.css';

export const metadata: Metadata = {
  title: 'Hoshi Jungle Review AI',
  description:
    'Hoshi Jungle のGoogleクチコミに、日本語・英語・インドネシア語で返信案を自動生成する管理ツール',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
