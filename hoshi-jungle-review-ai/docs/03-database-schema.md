# 03. Supabase テーブル設計

定義ファイル: `supabase/migrations/` 配下の 0001〜0004
**適用状況: Supabase プロジェクト `iwwddgqbollzzmzjrvak`（Free プラン）に適用・検証済み**
（検証結果は [docs/04 §2.1](04-runbook.md)）
TypeScript 型: `src/lib/database.types.ts`

## 1. ER 図

```mermaid
erDiagram
    users ||--o{ locations : "所有"
    locations ||--o{ reviews : "紐づく"
    reviews ||--o| replies : "1対1"
    locations ||--o{ sync_runs : "実行履歴"
    locations ||--o{ staff_access : "パスコード"
    users ||--o{ replies : "published_by"
    staff_access ||--o{ replies : "published_by_staff"

    users {
        uuid user_id PK
        text email UK
        text google_account_id UK "Google の sub クレーム"
        text google_refresh_token_encrypted "AES-256-GCM"
        timestamptz token_revoked_at "再認証が必要な時刻"
        timestamptz created_at
    }

    locations {
        uuid location_id PK
        uuid user_id FK
        text google_account_name "accounts/111"
        text google_location_id "locations/222"
        text name
        boolean setup_complete
        text default_ui_lang "共有端末が戻る言語"
        text area_label "返信文で使う所在地"
        text reply_signature "返信の署名"
        text contact_email "低評価時の連絡先"
        text_array highlights "AIが触れてよい魅力"
        boolean auto_publish_enabled "null=環境変数に従う"
        smallint auto_publish_min_rating
        text_array auto_publish_languages
        timestamptz last_synced_at
        text last_sync_error
        integer consecutive_failures
    }

    reviews {
        uuid review_id PK
        uuid location_id FK
        text google_review_id UK "冪等キー"
        smallint rating "1..5"
        text text
        review_language language "ja|en|id|other"
        real language_confidence
        language_source language_source
        timestamptz google_create_time
        boolean has_google_reply
    }

    replies {
        uuid reply_id PK
        uuid review_id FK UK
        text ai_generated_text
        text edited_text
        text final_text "生成列 = coalesce(edited, ai)"
        reply_status status
        boolean needs_human_attention
        text attention_reason
        text model
        jsonb generation_meta
        timestamptz published_at
    }

    staff_access {
        uuid staff_access_id PK
        uuid location_id FK
        text label "例: フロントデスク用"
        text passcode_hash "scrypt。平文は保存しない"
        text ui_lang "入室後の画面の言語。null=ホテルの既定"
        boolean is_active
        timestamptz last_used_at
        timestamptz rotated_at
    }

    sync_runs {
        uuid sync_run_id PK
        uuid location_id FK
        text trigger_source "cron|manual|onboarding"
        integer reviews_new
        integer replies_generated
        text error
    }
```

---

## 2. 仕様の最小スキーマからの差分と、その理由

仕様で提示された最小構成は下記でした。

```
users:     user_id, email, google_account_id, created_at
locations: location_id, user_id, google_location_id, name, setup_complete
reviews:   review_id, location_id, google_review_id, rating, text, language, created_at
replies:   reply_id, review_id, ai_generated_text, edited_text, status, created_at, published_at
```

この骨格はそのまま維持したうえで、**実運用で必ず必要になる列だけ**を足しています。

| テーブル | 追加した列 | なぜ必要か |
|---|---|---|
| `users` | `google_refresh_token_encrypted` | これが無いと毎時バッチが動かない。**AES-256-GCM で暗号化**して保存（平文はDB漏洩時に即アウト） |
| `users` | `token_revoked_at` | ユーザーが Google 側でアクセス権を削除すると全機能が静かに止まる。UI で再認証を促すために必要 |
| `locations` | `google_account_name` | **v4 のレビュー API は `accounts/{a}/locations/{l}` 形式を要求する。** location ID だけでは URL が組めない |
| `locations` | `last_synced_at` / `last_sync_error` / `consecutive_failures` | 「なぜ新しいクチコミが出てこないのか」に答えられないシステムは運用できない。連続失敗数はクォータ保護のバックオフ判断にも使う |
| `reviews` | `google_create_time` / `google_update_time` | DB の `created_at`（取り込み時刻）とクチコミの投稿日時は別物。並び替えは必ず Google 側の時刻を使う |
| `reviews` | `has_google_reply` / `google_reply_comment` | Google 側で他経路（Google マップアプリ等）から返信された場合に二重返信を防ぐ |
| `reviews` | `language_confidence` / `language_source` | 言語判定は確率的な処理。どの経路で判定したか（文字種/tinyld/Claude/手動）を残さないと、しきい値調整も品質検証もできない |
| `replies` | `final_text`（生成列） | `coalesce(edited_text, ai_generated_text)` を DB 側で確定させる。アプリ側の coalesce 忘れによる「編集したのに AI 原文が公開された」事故を構造的に防ぐ |
| `replies` | `needs_human_attention` / `attention_reason` | 承認待ちリストの実体。理由を日本語で保存し、スタッフが即座に優先度を判断できるようにする |
| `replies` | `model` / `generation_meta` (jsonb) | どのモデル・何トークンで生成したかの記録。コスト分析と、品質問題が起きたときの再現に使う |
| `replies` | `publish_error` | Google への投稿失敗をカードに表示して再試行できるようにする |
| `sync_runs` | テーブルごと新設 | 毎時バッチの可観測性。障害調査が SQL 1 本で終わる |

---

## 3. ENUM の設計

### `review_language`: `ja` / `en` / `id` / `other`

`other` を持つのが要点です。対応 3 言語以外のクチコミ（中国語・韓国語・ロシア語など）が
必ず来ます。これを `en` に丸めると誤った言語で返信してしまうため、`other` に落として
**要確認リストへ強制的に回します。**

将来 `zh` / `ko` を正式対応する場合は `alter type review_language add value 'zh'` で追加できます。

### `reply_status`: `draft` / `edited` / `published` / `failed` / `skipped`

仕様は `draft` / `published` の 2 値でしたが、実運用では区別が足りません。

| 値 | 意味 | どの画面に出るか |
|---|---|---|
| `draft` | AI が生成しただけ。人間未確認 | 未返信 / 要確認 |
| `edited` | 人間が編集して保存済み。未公開 | 未返信 / 要確認 |
| `published` | Google に公開済み | 履歴 |
| `failed` | 公開を試みて失敗、または AI 生成に失敗 | 未返信（エラー表示付き） |
| `skipped` | 返信しないと人間が判断した | 履歴 |

`draft` と `edited` を分けないと、「AI の案のまま放置されているもの」と
「人が手を入れて公開待ちのもの」がリスト上で混ざり、確認漏れの温床になります。

### `language_source`: `script` / `tinyld` / `claude` / `manual`

判定経路の記録。`script`（文字種による決定的判定）は信頼度 1.0、
`tinyld` は統計的判定、`claude` は tinyld が低信頼だったため AI 判定で上書きしたもの、
`manual` は人間が画面から修正したもの（`manual` は再同期時も上書きしません）。

---

## 4. インデックス

| インデックス | 対象 | 用途 |
|---|---|---|
| `reviews_google_review_id_key` (UNIQUE) | `reviews(google_review_id)` | **冪等性の要**。再同期・二重実行でも重複しない |
| `replies_review_id_key` (UNIQUE) | `replies(review_id)` | 1 レビュー 1 返信を DB で保証（Google 側も 1 対 1） |
| `reviews_location_created_idx` | `reviews(location_id, google_create_time desc)` | ダッシュボードの既定の並び |
| `reviews_unreplied_idx` (部分) | `reviews(location_id, google_create_time desc) WHERE NOT has_google_reply` | 未返信の抽出。部分インデックスなので公開済みが増えても肥大しない |
| `reviews_language_idx` | `reviews(location_id, language)` | 言語別タブ |
| `replies_attention_idx` (部分) | `replies(needs_human_attention) WHERE needs_human_attention` | 承認待ちリスト |
| `locations_active_idx` (部分) | `locations(setup_complete) WHERE setup_complete` | Cron の対象抽出 |

---

## 5. 制約による事故防止

```sql
-- 公開済みなら必ず本文と公開時刻が存在する
constraint replies_published_consistency
  check (status <> 'published' or (final_text is not null and published_at is not null))

-- 星は 1..5 のみ（Google の STAR_RATING_UNSPECIFIED を弾く）
constraint reviews_rating_range check (rating between 1 and 5)

-- 同一ユーザーによる同じロケーションの二重登録を防ぐ
constraint locations_user_google_location_key unique (user_id, google_location_id)
```

「アプリのバグで空文字が公開済みとして記録される」類の事故を、DB 層で止めます。

---

## 6. ビュー `review_queue`

`reviews LEFT JOIN replies` を 1 行にまとめたビュー。
ダッシュボードの 3 画面（未返信 / 要確認 / 履歴）はすべてこのビューを読み、
`status` と `needs_human_attention` の条件だけを変えています。
UI ごとに JOIN を書き直すと、条件の食い違いで件数バッジと一覧がずれます。

---

## 7. Row Level Security

本アプリの DB アクセスは **100% Next.js サーバー側（`service_role` キー）経由**です。
`service_role` は RLS をバイパスするため、RLS ポリシーはアプリの動作条件ではありません。

それでも全テーブルで RLS を有効にし、`anon` / `authenticated` に対して
明示的な**全拒否ポリシー**を置いています。目的は多層防御です:
**`anon` キーが万一漏れても、1 行も読めない。**

ビューには `security_invoker = on` を設定し、参照元テーブルの RLS を継承させています
（これを忘れるとビュー経由で RLS を迂回できてしまいます）。

将来クライアントから直接 Supabase を叩く設計に変える場合は、
`auth.uid()` ベースの SELECT ポリシーをここに追加します。

---

## 8. スタッフ用パスコード（0003）

| テーブル | 役割 |
|---|---|
| `staff_access` | ロケーション単位のパスコード。1 ロケーションに複数発行でき、片方だけ停止できる |
| `staff_login_attempts` | ログイン試行の記録。IP はハッシュ化して保存し、レート制限と不審アクセス検知に使う |
| `replies.published_by_staff_access_id` | 監査。スタッフが公開した場合、どのパスコード経由かを残す |
| `staff_access.ui_lang` / `locations.default_ui_lang` | 共有端末の表示言語。詳細は `docs/05-staff-access.md` の「共有端末での表示言語」 |
| `locations` の設定列（`area_label` 〜 `auto_publish_languages`） | 店舗ごとの設定。下記参照 |

## 店舗ごとの設定（0010）

店名・所在地・署名・連絡先・お店の魅力・自動公開の条件は、もともと環境変数
（`HOTEL_NAME` など）にあり、**システム全体で 1 組しか持てませんでした**。
この状態では店舗が増えるたびに別のシステムを立ち上げることになり、
複数店舗への販売が成り立ちません。そこで `locations` の列に移しました。

### すべて NULL 可にしている理由

NULL は「この店では未設定」を意味し、アプリは環境変数の値にフォールバックします
（`src/lib/settings/locationSettings.ts`）。この設計により、**マイグレーションを
当てただけでは既存店の挙動が一切変わりません**。オーナーが設定画面で値を入れた
時点で、その店だけが切り替わります。

とくに `auto_publish_enabled` を `not null default false` にしなかったのは、
環境変数で自動公開を有効にしていた店が、移行と同時に無効化されてしまうためです。
NULL（未設定）と false（明示的に無効）は区別する必要があります。
この性質は `tests/locationSettings.test.ts` で固定しています。

### `highlights` が持つ意味

「AI が触れてよい事実の範囲」そのものです。ここに無い設備・サービス・料理には、
クチコミ本文が言及している場合を除き触れさせません。空のときは指示を消さず、
「本文に書かれていること以外に触れるな」という指示に切り替えます
（指示ごと消すと、AI が一般的なホテル像から設備を補ってしまうため）。

### インドネシア語を 3 段で弾いている

自動公開の対象からインドネシア語を外すのは仕様上の制約で、店ごとに変えてよい
判断ではありません。次の 3 箇所で同じ条件を弾いています。

1. DB 制約 `locations_auto_publish_languages_no_id_check`
2. 設定の正規化 `sanitizeAutoPublishLanguages()`（環境変数由来の値はここを通る）
3. 判定 `shouldAutoPublish()`

**`passcode_hash` に平文は入りません。** scrypt (N=32768, r=8, p=1) でハッシュ化し、
発行直後の 1 回だけ画面に表示します。これは「あとで見返せる」と誤解させないための
意図的な制約です。紛失時は再発行してもらいます。

`failed_attempts` / `locked_until` のようなレコード単位のロック列は**意図的に持っていません。**
ハッシュ保存では不一致時に「どのレコードが狙われたか」を特定できず、特定できる形にすると
他人のパスコードを故意にロックする嫌がらせが成立するためです（詳細は
[docs/05 §5](05-staff-access.md)）。

---

## 9. 適用方法

```bash
# Supabase CLI を使う場合
supabase link --project-ref <project-ref>
supabase db push

# CLI を使わない場合
# Supabase Dashboard → SQL Editor に 0001 → 0002 → 0003 の順で貼り付けて実行
```

スキーマを変更したら `src/lib/database.types.ts` も手で同期してください
（`supabase gen types typescript` での再生成も可。ただし本ファイルは外部キー定義を
含んでおり、埋め込み select の型解決に使われているため、削らないこと）。
