import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { FlatCompat } from '@eslint/eslintrc';

/**
 * ESLint の設定。
 *
 * next/core-web-vitals（Next.js の推奨 + Core Web Vitals）と
 * next/typescript（TypeScript 向けの規則）だけを有効にしている。
 * 独自の規則は足していない。ルールを増やすより、
 * 型検査（npm run typecheck）とテスト（npm test）で担保する方針。
 */
const compat = new FlatCompat({ baseDirectory: dirname(fileURLToPath(import.meta.url)) });

const config = [
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'out/**',
      // Next.js が自動生成する型定義。手で直しても上書きされる。
      'next-env.d.ts',
      // 資料PDFを作るための使い捨てスクリプト。アプリの一部ではない。
      'docs/proposal/**',
    ],
  },
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    rules: {
      // 設定ファイルは無名の default export が通例（Next.js 自身の雛形もそう）。
      'import/no-anonymous-default-export': 'off',
    },
  },
];

export default config;
