# 07. 全部無料で動かす構成

## 1. 結論

**月額 $0 で運用できます。** ただし条件が 2 つあります。

1. ホスティングは Vercel ではなく **Netlify Free** を使う
2. AI の生成量に**月次の上限**を設ける（既定: 約 43 件/月）

| サービス | プラン | 月額 | 用途 |
|---|---|---|---|
| Netlify | Free | **$0** | ダッシュボードの表示 |
| GitHub Actions | Free | **$0** | 毎時のクチコミ取得バッチ |
| Supabase | Free | **$0** | データベース |
| Google Business Profile API | — | **$0** | クチコミの取得・返信 |
| Claude API | 従量課金 | **$0**（無料クレジット内） | 返信案の生成 |

Claude API だけは本来従量課金ですが、Anthropic の新規アカウントに付与される
**$5 の無料クレジット**の範囲に収まるよう、システム側で上限を強制しています。
既定設定（`claude-haiku-4-5` / 月 $0.40）なら **約 13 か月ぶん**あります。

---

## 2. なぜこの構成になったか（検討した選択肢）

### ホスティング

| 候補 | 判定 | 理由 |
|---|---|---|
| Vercel Hobby | ✕ | **非商用の個人利用限定。** ホテルの業務ツールは商用に該当し規約違反。予告なく停止される |
| Cloudflare Workers Free | ✕ | **CPU 10ms 制限。** パスコード認証の scrypt が実測 93ms かかるため動かない |
| **Netlify Free** | ○ | **商用プロジェクトのデプロイを明示的に許可。** 実 Node.js なので scrypt も動く |

Netlify Free の制約は**関数タイムアウト 10 秒**（バックグラウンド関数は Pro 以上）。
AI 生成を含むバッチは収まらないため、次の設計で回避しています。

### スケジューラ

Vercel Cron は Pro が必要、Netlify Free の関数は 10 秒で切れる。
そこで**重いバッチは GitHub Actions に逃がしました**。

- プライベートリポジトリでも **月 2,000 分まで無料**
- 1 ジョブ最大 6 時間（タイムアウトの心配がない）
- 毎時実行 = 月 720 回 → 約 720 分（無料枠の約 36%）

ワークフロー: `.github/workflows/sync-reviews.yml`
ワーカー本体: `hoshi-jungle-review-ai/scripts/sync-worker.ts`

---

## 3. 時間予算という設計

Web アプリ側の API も 10 秒制限を受けるため、**1 回の呼び出しを 7 秒で必ず打ち切る**
設計にしています。

```
syncLocation(locationId, source, { timeBudgetMs: 7000 })
  → 7秒以内に処理できたところまで進めて hasMore を返す
  → 呼び出し側が hasMore=false になるまで繰り返す
```

- ブラウザ（「今すぐ同期」ボタン、初期設定ウィザード）が進捗を出しながらループ
- GitHub Actions は大きな時間予算（10 分）で同じ関数を呼ぶ
- **途中で中断しても DB は常に整合した状態**（冪等キーがあるため）

この設計の副次的な利点として、**長時間実行できるサーバーが一切不要**になり、
どのホスティングへ移しても動きます。将来 Vercel Pro に移行したくなっても変更は要りません。

---

## 4. AI の月次予算（無料枠を守る仕組み）

「気をつけて使う」という運用ルールではなく、**システムが強制します。**

```
生成のたびに実トークン数からコストを算出 → ai_usage テーブルに記録
       ↓
次の生成前に当月の合計を確認
       ↓
「次の 1 件を生成する余裕がない」時点で生成を停止
```

超えてから止めるのではなく、**超える手前で止める**ため、予算を 1 セントも超過しません。

### 停止しても壊れない

予算に達しても止まるのは**返信案の生成だけ**です。

- クチコミの取得は続く（新着は見える）
- スタッフは手動で返信を書いて公開できる
- 翌月 1 日に自動でリセットされる（月境界の判定は実 DB で検証済み）

ダッシュボード下部に「今月の AI 返信案: 残りおよそ N 件」が常時表示され、
使い切ると案内が出ます。

### 設定と目安

`AI_MONTHLY_BUDGET_USD`（既定 `0.40`）と `ANTHROPIC_MODEL` で決まります。

| モデル | 1 件あたり | 月 $0.40 で | $5 クレジットで |
|---|---|---|---|
| **`claude-haiku-4-5`（既定）** | $0.0091 | **約 43 件/月** | 約 549 件 |
| `claude-sonnet-5` | $0.0182 | 約 21 件/月 | 約 274 件 |
| `claude-opus-5` | $0.0455 | 約 8 件/月 | 約 109 件 |

> 1 回の生成で**3 案**を作るため、単一案のときより出力トークンが約 3 倍になっている。

> 数値は入力 1,600 tok / 出力 800 tok を安全側に見積もった概算です
> （`tests/pricing.test.ts` に回帰テストあり）。実績は `ai_usage` テーブルで確認できます。

**返信量を増やしたい場合**は `AI_MONTHLY_BUDGET_USD` を上げるだけです。
上げた額がそのまま上限になります。管理費は発生しません。

| `AI_MONTHLY_BUDGET_USD` | 月額の目安 | 返信数 |
|---|---|---|
| `0.40`（既定） | 0円（無料クレジット内） | 約 43 件/月 |
| `1.00` | 約 150 円 | 約 109 件/月 |
| `2.00` | 約 300 円 | 約 219 件/月 |
| `5.00` | 約 750 円 | 約 549 件/月 |

> 円換算は 1 ドル 150 円で計算。為替で変動します。
> 無料クレジット $5 を使い切るまでは、いずれの設定でも支払いは発生しません
> （既定の $0.40/月なら約 12 か月ぶん）。

### なぜ既定を haiku にしたか

ホテルのクチコミ返信は難易度の高いタスクではなく、Haiku でも実用的な品質が出ます。
一方で単価は Opus の 1/5 です。**品質を最優先する場合は
`ANTHROPIC_MODEL=claude-opus-5` に変更してください**（その場合 $5 クレジットは約 178 件ぶん）。

低評価への返信だけ品質を上げたい、といった使い分けは現状できません。
必要になれば「評点で使うモデルを変える」実装は容易に追加できます。

---

## 5. セットアップ手順（無料構成）

### 5.1 Supabase — ✅ 完了済み

プロジェクト `hoshi-jungle-review-ai`（ref: `iwwddgqbollzzmzjrvak`）作成・適用済み。
詳細は [docs/04 §2.1](04-runbook.md)。

### 5.2 Anthropic API キー

1. [console.anthropic.com](https://console.anthropic.com) でアカウント作成（**$5 の無料クレジット**が付く）
2. API キーを発行する
3. **クレジットカードは登録しない。** 登録しなければ、クレジットを使い切った時点で
   API が止まるだけで、請求は発生しません

### 5.3 Google Cloud

[docs/02 §3](02-google-oauth-flow.md) の手順。すべて無料ですが、
**API アクセス申請の承認に数営業日〜数週間**かかります。最優先で着手してください。
ログインに使うアカウントは必ず Hoshi Jungle のもの（[docs/06](06-google-account-ownership.md)）。

### 5.4 Netlify（無料）

1. [netlify.com](https://netlify.com) にログイン → **Add new site → Import an existing project**
2. このリポジトリを選択
3. 設定は `netlify.toml` が持っているので、そのまま **Deploy**
4. 数分で **`https://<サイト名>.netlify.app` が発行されます** ← これがスタッフに渡す URL
5. Site configuration → Environment variables に `.env.example` の各キーを登録
6. `NEXT_PUBLIC_APP_URL` と `GOOGLE_REDIRECT_URI` を発行された URL に合わせて再デプロイ
7. Google Cloud Console の「承認済みのリダイレクト URI」にも同じ URL を追加

### 5.5 GitHub Actions（無料・定期同期）

リポジトリの **Settings → Secrets and variables → Actions** に登録します。

**Secrets（秘密。値は表示されなくなる）**

| キー | 取得元 |
|---|---|
| `SUPABASE_URL` | `https://iwwddgqbollzzmzjrvak.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Dashboard → Project Settings → API Keys |
| `GOOGLE_CLIENT_ID` | Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | Google Cloud Console |
| `ANTHROPIC_API_KEY` | Anthropic Console |
| `TOKEN_ENCRYPTION_KEY` | **Netlify に設定したものと同じ値**（別の値だとトークンを復号できない） |

**Variables（秘密でない設定。未設定なら括弧内が既定値）**

| キー | 推奨値 |
|---|---|
| `ANTHROPIC_MODEL` | `claude-haiku-4-5` |
| `AI_MONTHLY_BUDGET_USD` | `0.40` |
| `HOTEL_NAME` | `Hoshi Jungle` |
| `HOTEL_LOCATION` | `Ubud, Bali, Indonesia` |

登録後、**Actions タブ → Sync Google Reviews → Run workflow** で手動実行して動作確認できます。

> `TOKEN_ENCRYPTION_KEY` は Netlify と GitHub で**必ず同じ値**にしてください。
> Netlify 側で暗号化した Google トークンを、GitHub Actions 側が復号するためです。

---

## 6. 無料枠を使い切らないための上限まとめ

| 資源 | 無料枠 | 想定使用量 | 余裕 |
|---|---|---|---|
| Netlify 帯域 | 100 GB/月 | 数十 MB | 十分 |
| Netlify 関数実行 | 125,000 回/月 | 数百回 | 十分 |
| GitHub Actions | 2,000 分/月 | 約 720 分（毎時実行） | 約 36% 使用 |
| Supabase DB | 500 MB | 数 MB | 十分 |
| Supabase 自動停止 | 1 週間無活動で停止 | 毎時 DB に触れる | 該当しない |
| Claude API | $5 無料クレジット | 月 $0.40 | 約 13 か月 |

**最も先に尽きるのは Claude のクレジット（約 13 か月後）です。**
その時点で月 60 円程度の支払いが発生するか、`AI_MONTHLY_BUDGET_USD=0` にして
AI 生成を止める（クチコミ取得と手動返信は無料で続く）かを選べます。

同期頻度を下げれば GitHub Actions の消費も減らせます。
`.github/workflows/sync-reviews.yml` の `cron` を
`'0 */6 * * *'`（6 時間ごと = 月約 120 分）などに変更してください。
ホテル運営では「投稿から返信まで数時間以内」で十分実用的です。
