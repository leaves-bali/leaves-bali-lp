# Hoshi Jungle Review AI

バリ島のホテル **Hoshi Jungle** 向け、Google マップのクチコミ自動返信システム。
日本語・英語・インドネシア語のクチコミに対して Claude が返信案を生成し、
ホテルスタッフがダッシュボードで確認・編集して公開します。

> **設計の中心にある判断: 完全自動公開をしない。**
> AI が生成した返信は Google 上に恒久的に公開され、将来の宿泊検討者が読みます。
> 既定動作は「全件ドラフト保存 → 人間が確認して公開」です。

---

## 主要機能

| 機能 | 実装状況 |
|---|---|
| Google OAuth 2.0 認証（Business Profile） | ✅ |
| レビューの自動フェッチ（Cron） | ✅ |
| 返信済み / 未返信の分別 | ✅ |
| 言語自動検出（ja / en / id） | ✅ 文字種 → tinyld → Claude の 3 段構え |
| 評点別トーンの返信生成（5 / 4 / 3 / 1-2 星） | ✅ Claude Structured Outputs |
| ダッシュボード（言語別タブ） | ✅ |
| 返信案の編集・ワンクリック公開・AI 再生成 | ✅ |
| 承認待ち（要確認）リスト | ✅ |
| インドネシア語の優先チェック（色分け） | ✅ |
| 返信履歴・アーカイブ | ✅ |
| 初期設定ウィザード（3 ステップ） | ✅ |
| ドラフト保存（完全自動公開の回避） | ✅ 既定で全件ドラフト |
| **スタッフ用パスコードログイン** | ✅ Google アカウント不要 |
| **パスコードの発行・再発行・停止** | ✅ オーナー専用画面 |
| **AI 生成の月次予算（無料枠の強制）** | ✅ 超える手前で自動停止 |

## 技術スタック

- **フロントエンド** — Next.js 15 (App Router) / React 19 / TypeScript / Tailwind CSS
- **バックエンド** — Next.js API Routes（Node ランタイム）
- **AI** — Claude API (`claude-opus-5`) / Structured Outputs
- **DB** — Supabase (PostgreSQL) / Row Level Security
- **認証** — Google OAuth 2.0（`business.manage` スコープ）
- **言語検出** — tinyld（`langdetect` の TypeScript 相当。理由は下記）
- **デプロイ** — Vercel（Cron / 環境変数）

## ドキュメント

| ドキュメント | 内容 |
|---|---|
| [01. アーキテクチャ](docs/01-architecture.md) | 全体構成図・ファイルツリー・データフロー・冪等性と失敗時の挙動 |
| [02. Google 認証フロー](docs/02-google-oauth-flow.md) | シーケンス図・スコープ・Google Cloud 設定手順・API の落とし穴 |
| [03. DB スキーマ](docs/03-database-schema.md) | ER 図・各列の設計理由・インデックス・RLS |
| [04. 運用 Runbook](docs/04-runbook.md) | セットアップ・デプロイ・日常運用・障害調査 SQL・コスト試算 |
| [05. スタッフ引き渡し](docs/05-staff-access.md) | 権限設計・パスコード方式の理由・引き渡し手順・セキュリティ |
| [06. Google アカウントの選定](docs/06-google-account-ownership.md) | **どのアカウントでログインするか**（着手前に要決定） |
| [07. 全部無料で動かす構成](docs/07-free-tier.md) | **月額 $0 の構成**・Netlify/GitHub Actions 手順・AI 月次予算 |

## 2 つの役割

| 役割 | 入口 | ログイン方法 | できること |
|---|---|---|---|
| **オーナー**（1人） | `/` | Google アカウント | Google 連携、ロケーション登録、パスコード発行、返信操作すべて |
| **スタッフ**（何人でも） | `/staff` | パスコード `HJ-XXXX-XXXX` | クチコミの確認・編集・公開 |

**スタッフは Google の認証情報に一切触れません。** 返信の公開はサーバー側で
オーナーのトークンを使って実行されます。退職・漏洩時はパスコードを再発行するだけで
即座に締め出せます。詳細は [docs/05](docs/05-staff-access.md)。

> **スタッフに渡す URL はデプロイ後に発行されます。**
> 現時点ではコードが GitHub にあるだけで、URL は存在しません。
> Vercel にデプロイすると `https://<プロジェクト名>.vercel.app/staff` が入口になります。
> 手順は [docs/04 §2.5](docs/04-runbook.md)。

## 構築の進捗

| ステップ | 状態 |
|---|---|
| コード実装 | ✅ 完了 |
| Supabase プロジェクト作成＋マイグレーション適用 | ✅ 完了（`iwwddgqbollzzmzjrvak` / Free プラン） |
| 無料構成への対応（Netlify / GitHub Actions / AI月次予算） | ✅ 完了 |
| Google API アクセス申請 | ⬜ **未着手 — 最優先**（承認に数営業日〜数週間・無料） |
| Google Cloud で OAuth クライアント ID 作成 | ⬜ 未着手（無料） |
| Anthropic API キー取得 | ⬜ 未着手（新規登録で $5 無料・カード登録不要） |
| Netlify にデプロイ | ⬜ 未着手（無料／**ここで URL が発行される**） |
| GitHub Secrets 登録（定期同期の有効化） | ⬜ 未着手（無料） |
| スタッフへのパスコード配布 | ⬜ デプロイ後 |

> **⚠️ アプリにログインする Google アカウントは必ず Hoshi Jungle のものを使ってください。**
> 代行者個人のアカウントでログインすると、その人がビジネスプロフィールへのアクセスを
> 失った時点でシステムが停止します。詳細は [docs/06](docs/06-google-account-ownership.md)。

## クイックスタート

```bash
npm install
cp .env.example .env.local   # 値を埋める（docs/04-runbook.md §2 参照）
npm run dev
```

```bash
npm run typecheck   # 型検査
npm test            # ユニットテスト
npm run build       # 本番ビルド
```

---

## 実装上の重要な判断

### 1. 言語検出は `langdetect` ではなく `tinyld` + 文字種チェック

仕様では `langdetect` が指定されていましたが、これは Python ライブラリで
Next.js / Vercel の Node ランタイムでは動きません。同等の n-gram 判定を行う
TypeScript ネイティブの `tinyld` を採用しています。

さらに、実測で **「最高！」のような短い日本語を tinyld が判定不能（候補ゼロ）で返す**
ことを確認したため、かな・漢字の文字種チェックを前段に置く 2 段構えにしました。
クチコミは短文の比率が高く、この 1 行が日本語の取りこぼしを防ぎます
（回帰テスト: `tests/detect.test.ts`）。

### 2. Google のレビュー API はレガシー v4 のみ

ビジネスプロフィール API は 2022 年に用途別へ分割されましたが、
**レビューだけは新 API に移行されておらず `mybusiness.googleapis.com/v4` が現役**です。
本システムは 3 つのホストを使い分けています（詳細は [docs/02](docs/02-google-oauth-flow.md)）。

### 3. Google API の利用申請が最大のリードタイム

Google Cloud で API を有効化しただけではクォータが 0 のため呼び出せません。
アクセス申請の承認に**数営業日〜数週間**かかります。実装より先に申請を出してください。

### 4. ホスティングは Netlify（Vercel ではない）

- **Vercel Hobby は非商用の個人利用限定**で、ホテルの業務ツールは規約違反になる（Pro は $20/月）
- **Cloudflare Workers Free は CPU 10ms 制限**があり、パスコード認証の scrypt（実測 93ms）が動かない
- **Netlify Free は商用プロジェクトを明示的に許可**しており、実 Node.js なので scrypt も動く

Netlify Free の関数タイムアウトは 10 秒。そのため重いバッチは GitHub Actions に逃がし、
画面から呼ぶ API はすべて 7 秒の時間予算で打ち切る設計にしている。

### 費用: 月額 $0

| 項目 | 月額 |
|---|---|
| Netlify Free（ホスティング） | $0 |
| GitHub Actions（定期同期・月720分/2,000分） | $0 |
| Supabase Free（DB） | $0 |
| Google Business Profile API | $0 |
| Claude API | $0（新規 $5 無料クレジット内） |

Claude API のみ本来は従量課金だが、**月次予算をシステムが強制**するため無料枠を超えない。
既定（`claude-haiku-4-5` / 月 $0.40 = 約 71 件）で **$5 クレジットが約 13 か月**持つ。
詳細は [docs/07](docs/07-free-tier.md)。

---

## ライセンス / 取り扱い

本システムは Hoshi Jungle の Google ビジネスプロフィールを操作します。
`TOKEN_ENCRYPTION_KEY` を紛失すると保存済みの認証情報が復号できなくなるため、
鍵の管理には十分注意してください。
