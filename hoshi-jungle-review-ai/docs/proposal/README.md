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
node build-pdf.mjs      # build-pdf-slides.html を Chromium で PDF 化
```
`build-pdf-slides.html` を編集してから実行します。`DEMO_IMG_SRC` は
ダッシュボードのスクリーンショットを base64 で差し込むプレースホルダです。

> この環境では LibreOffice が動作しないため、PPTX からの変換ではなく
> HTML を Chromium で直接 PDF 化しています。文字はアウトライン化されず、
> 検索・選択が可能な状態で出力されます。

### PowerPoint
```bash
node build-deck.js      # pptxgenjs で .pptx を生成
```

## 素材
- `slide-demo.png` — ダッシュボードの実画面キャプチャ（`../presentation.html` から取得）
