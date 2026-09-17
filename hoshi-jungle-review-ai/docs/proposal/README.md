# Hoshi Jungle 向け提案資料

先方へのプレゼン用。内容は3形態とも同じです。

| ファイル | 用途 |
|---|---|
| `hoshi-jungle-proposal.pdf` | **プレゼン本番用。** 10ページ・16:9。全画面表示して1枚ずつ送る |
| `hoshi-jungle-proposal.pptx` | 相手が編集したい場合・PowerPointで見たい場合 |
| `../presentation.html` | Webデモ（実際に操作できる）。打ち合わせ中に開く |

## 作り直し方

### PDF
```bash
# 1. スクリーンショットを埋め込んだ HTML を組み立てる
node -e "const fs=require('fs');const h=fs.readFileSync('build-pdf-slides.html','utf8');\
const i='data:image/png;base64,'+fs.readFileSync('slide-demo.png').toString('base64');\
fs.writeFileSync('/tmp/slides.built.html', h.replace(/DEMO_IMG_SRC/g, i));"

# 2. Chromium で PDF 化（build-pdf.mjs は /tmp/slides.built.html を読む）
node build-pdf.mjs
```
`build-pdf-slides.html` を編集してから実行します。`DEMO_IMG_SRC` は
ダッシュボードのスクリーンショットを base64 で差し込むプレースホルダです。

> **playwright が必要です。** このリポジトリの依存には含まれていないため、
> `build-pdf.mjs` を playwright が解決できる場所から実行してください
> （`npm i -g playwright` 済みの環境なら、グローバルの node_modules を持つ
> ディレクトリで実行する）。ブラウザ本体は `/opt/pw-browsers` のものを
> `executablePath` で直接指定しているので、`playwright install` は不要です。

`build-pdf.mjs` は PDF 化の前に、全スライドが 1280x720 に収まっているか
（要素のはみ出し・JS エラー）を検査して結果を出力します。

> この環境では LibreOffice が動作しないため、PPTX からの変換ではなく
> HTML を Chromium で直接 PDF 化しています。文字はアウトライン化されず、
> 検索・選択が可能な状態で出力されます。

### PowerPoint
```bash
node build-deck.js      # pptxgenjs で .pptx を生成
```

## 素材
- `slide-demo.png` — ダッシュボードの実画面キャプチャ（`../presentation.html` から取得）
