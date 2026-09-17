const pptx = require("pptxgenjs");
const fs = require("fs");

const pres = new pptx();
pres.layout = "LAYOUT_WIDE"; // 13.3 x 7.5
pres.author = "Leaves Bali";
pres.company = "Leaves Bali";
pres.title = "Hoshi Jungle Review AI";

// ---- palette (Webデモと同じ配色) ----
const PINE = "1F5C47";
const PINE_D = "153F31";
const DARK = "111C16";
const MOSS = "DDEAE2";
const SURF = "F2F6F1";
const WHITE = "FFFFFF";
const INK = "16221A";
const INK2 = "44584B";
const INK3 = "72877A";
const BRASS = "9A7A32";
const WARN = "8A5A11";
const WARNBG = "FAEFD9";
const LINE = "D8E0D5";

const HEAD = "Yu Gothic";
const BODY = "Yu Gothic";

const W = 13.3;
const H = 7.5;
const M = 0.75; // 左右マージン

const DEMO_IMG = "/tmp/claude-0/slide-demo.png";

// ---------- helpers ----------

/** 見出し（明るい地のスライド用） */
function heading(s, text, sub) {
  s.addText(text, {
    x: M, y: 0.52, w: W - M * 2, h: 0.72,
    fontFace: HEAD, fontSize: 32, bold: true, color: INK,
    align: "left", isTextBox: true, margin: 0,
  });
  if (sub) {
    s.addText(sub, {
      x: M, y: 1.28, w: W - M * 2, h: 0.4,
      fontFace: BODY, fontSize: 13, color: INK3,
      align: "left", isTextBox: true, margin: 0,
    });
  }
}

/** 通し番号のチップ（この資料のモチーフ。全スライドで同じ形） */
function chip(s, x, y, label, bg, fg) {
  s.addShape(pres.ShapeType.roundRect, {
    x: x, y: y, w: 0.42, h: 0.42,
    fill: { color: bg || PINE }, rectRadius: 0.1, line: { color: bg || PINE, width: 0 },
  });
  s.addText(label, {
    x: x, y: y, w: 0.42, h: 0.42,
    fontFace: HEAD, fontSize: 14, bold: true, color: fg || WHITE,
    align: "center", valign: "middle", isTextBox: true, margin: 0,
  });
}

/** カード（薄い面 + 細い枠。ストライプは使わない） */
function card(s, x, y, w, h, fill) {
  s.addShape(pres.ShapeType.roundRect, {
    x: x, y: y, w: w, h: h,
    fill: { color: fill || WHITE }, rectRadius: 0.06,
    line: { color: LINE, width: 1 },
  });
}

function footer(s, n) {
  s.addText("Leaves Bali  ·  Hoshi Jungle Review AI", {
    x: M, y: H - 0.52, w: 6, h: 0.3,
    fontFace: BODY, fontSize: 9, color: INK3, isTextBox: true, margin: 0,
  });
  s.addText(String(n), {
    x: W - M - 1, y: H - 0.52, w: 1, h: 0.3,
    fontFace: BODY, fontSize: 9, color: INK3, align: "right", isTextBox: true, margin: 0,
  });
}

// =====================================================================
// 1. 表紙
// =====================================================================
{
  const s = pres.addSlide();
  s.background = { color: DARK };

  s.addText("LEAVES BALI  →  HOSHI JUNGLE 御中", {
    x: M, y: 1.5, w: 10, h: 0.35,
    fontFace: BODY, fontSize: 11, bold: true, color: INK3, charSpacing: 2,
    isTextBox: true, margin: 0,
  });

  s.addText("クチコミ返信を、", {
    x: M, y: 2.15, w: 11, h: 0.88,
    fontFace: HEAD, fontSize: 46, bold: true, color: WHITE,
    isTextBox: true, margin: 0,
  });
  s.addText("取りこぼさない。", {
    x: M, y: 3.10, w: 11, h: 0.88,
    fontFace: HEAD, fontSize: 46, bold: true, color: "6FC7A1",
    isTextBox: true, margin: 0,
  });

  s.addText(
    "Googleマップに届く日本語・英語・インドネシア語のクチコミに、AIが返信の下書きを用意します。\n公開するかどうかを決めるのは、いつでもスタッフの方です。",
    {
      x: M, y: 4.25, w: 8.6, h: 0.9,
      fontFace: BODY, fontSize: 14, color: "AFC2B4", lineSpacing: 24,
      isTextBox: true, margin: 0,
    }
  );

  s.addShape(pres.ShapeType.line, {
    x: M, y: 5.5, w: 3.2, h: 0, line: { color: "2E4638", width: 1 },
  });

  s.addText("Hoshi Jungle Review AI   ご提案 · 2026年9月", {
    x: M, y: 5.72, w: 9, h: 0.35,
    fontFace: BODY, fontSize: 11, color: INK3, isTextBox: true, margin: 0,
  });

  s.addNotes(
    "システムはすでに完成しています。本日は、実際の画面を見ていただくのが目的です。"
  );
}

// =====================================================================
// 2. 課題
// =====================================================================
{
  const s = pres.addSlide();
  s.background = { color: SURF };
  heading(s, "返信が止まるのは、書けないからではありません", "宿泊施設のクチコミ運用でよく起きている状態");

  const items = [
    ["言語が混ざる", "日本語・英語・インドネシア語が同じ画面に並びます。その言語で書ける人が、その日いるとは限りません。"],
    ["文面を考える時間が要る", "1件あたり数分でも、積み重なると手が回りません。「あとで」が積み上がっていきます。"],
    ["低評価ほど後回しになる", "本当は真っ先に返したい低評価ほど、文面に悩んで時間がかかります。その間も検討中の方が読んでいます。"],
  ];

  let y = 2.0;
  items.forEach(function (it, i) {
    card(s, M, y, W - M * 2, 1.32);
    chip(s, M + 0.42, y + 0.45, String(i + 1));
    s.addText(it[0], {
      x: M + 1.1, y: y + 0.26, w: 3.6, h: 0.42,
      fontFace: HEAD, fontSize: 18, bold: true, color: INK, isTextBox: true, margin: 0,
    });
    s.addText(it[1], {
      x: M + 4.8, y: y + 0.28, w: W - M * 2 - 5.3, h: 0.85,
      fontFace: BODY, fontSize: 12.5, color: INK2, lineSpacing: 20,
      isTextBox: true, margin: 0,
    });
    y += 1.55;
  });

  footer(s, 2);
  s.addNotes("ここは「困っているはず」と決めつけず、よくある状態として置いています。");
}

// =====================================================================
// 3. 3本柱
// =====================================================================
{
  const s = pres.addSlide();
  s.background = { color: SURF };
  heading(s, "このシステムがすること", "できることは3つだけです");

  const cols = [
    ["届いた言語で、\nそのまま返す", "日本語には日本語、英語には英語、インドネシア語にはインドネシア語で返信案を作ります。翻訳の貼り付けではありません。", PINE],
    ["勝手には\n公開しない", "AIが書くのは下書きまで。スタッフが読んで、直して、ボタンを押して初めてGoogleに反映されます。", PINE],
    ["運用費は\n月額0円", "サーバー・データベース・Google連携はすべて無料枠で運用します。追加のご負担はありません。", BRASS],
  ];

  const cw = (W - M * 2 - 0.6) / 3;
  cols.forEach(function (c, i) {
    const x = M + i * (cw + 0.3);
    card(s, x, 2.05, cw, 3.55);
    s.addShape(pres.ShapeType.roundRect, {
      x: x + 0.45, y: 2.5, w: 0.5, h: 0.5,
      fill: { color: c[2] }, rectRadius: 0.12, line: { color: c[2], width: 0 },
    });
    s.addText(String(i + 1), {
      x: x + 0.45, y: 2.5, w: 0.5, h: 0.5,
      fontFace: HEAD, fontSize: 16, bold: true, color: WHITE,
      align: "center", valign: "middle", isTextBox: true, margin: 0,
    });
    s.addText(c[0], {
      x: x + 0.45, y: 3.2, w: cw - 0.9, h: 1.0,
      fontFace: HEAD, fontSize: 19, bold: true, color: INK, lineSpacing: 28,
      isTextBox: true, margin: 0,
    });
    s.addText(c[1], {
      x: x + 0.45, y: 4.3, w: cw - 0.9, h: 1.1,
      fontFace: BODY, fontSize: 11.5, color: INK2, lineSpacing: 18,
      isTextBox: true, margin: 0,
    });
  });

  footer(s, 3);
}

// =====================================================================
// 4. 実際の画面
// =====================================================================
{
  const s = pres.addSlide();
  s.background = { color: SURF };

  s.addText("スタッフが毎朝ひらく画面です", {
    x: M, y: 0.55, w: 6.4, h: 1.0,
    fontFace: HEAD, fontSize: 30, bold: true, color: INK, isTextBox: true, margin: 0,
  });

  const pts = [
    "新しいクチコミは毎時間、自動で集まります",
    "AIの返信案がすでに入っています",
    "言語ごとにタブで分けて確認できます",
    "低評価とインドネシア語は「要確認」に分けて表示",
  ];
  let y = 2.0;
  pts.forEach(function (t) {
    s.addShape(pres.ShapeType.roundRect, {
      x: M, y: y + 0.08, w: 0.16, h: 0.16,
      fill: { color: PINE }, rectRadius: 0.05, line: { color: PINE, width: 0 },
    });
    s.addText(t, {
      x: M + 0.38, y: y - 0.04, w: 5.6, h: 0.5,
      fontFace: BODY, fontSize: 13, color: INK2, isTextBox: true, margin: 0,
    });
    y += 0.62;
  });

  s.addText("この画面は実物です。デモでは文章を書き換えたり、公開ボタンを押したりして、実際に触っていただけます。", {
    x: M, y: 4.85, w: 5.9, h: 0.9,
    fontFace: BODY, fontSize: 11.5, color: INK3, lineSpacing: 18,
    isTextBox: true, margin: 0,
  });

  if (fs.existsSync(DEMO_IMG)) {
    // 元画像 1000 x 1079
    const h = 6.2;
    const w = h * (1000 / 1079);
    s.addImage({ path: DEMO_IMG, x: W - M - w, y: 0.62, w: w, h: h });
  }

  footer(s, 4);
  s.addNotes("ここでWebデモのURLを開いて、実際に操作してもらうのが一番伝わります。");
}

// =====================================================================
// 5. 返信の実例
// =====================================================================
{
  const s = pres.addSlide();
  s.background = { color: SURF };
  heading(s, "AIが書く返信は、こういう文章です", "評点に応じて書き分けます。下はデモ用のサンプルです");

  const cw = (W - M * 2 - 0.4) / 2;

  const ex = [
    {
      x: M,
      stars: "★★★★★",
      starColor: BRASS,
      who: "田中 美咲 · 日本語",
      review: "ジャングルビューのプールが忘れられません。朝は鳥の声で目が覚めて、夜はカエルの合唱。スタッフの皆さんも本当に温かくて、バリで一番好きな場所になりました。",
      reply: "田中様、こうしてお言葉を残してくださり、ありがとうございます。\n鳥の声で目覚め、カエルの合唱で眠る——私たちがこの谷に宿をつくった理由を、そのまま言葉にしていただいたようです。スタッフにも必ず伝えます。\n次にお越しの際は、霧が谷を渡る早朝の時間もぜひ。",
      tone: "5つ星 → 感謝と、次回の楽しみを一つだけ",
    },
    {
      x: M + cw + 0.4,
      stars: "★★",
      starColor: BRASS,
      who: "Michael R. · English",
      review: "Room wasn't clean on arrival and the AC in the bedroom didn't work for two nights. Staff were apologetic but nothing was actually fixed.",
      reply: "Michael, thank you for telling us — and I am sorry.\nArriving to a room that had not been properly cleaned, then two nights without working air conditioning, is not a stay we can be satisfied with.\nWe have taken both points to our housekeeping and engineering teams.",
      tone: "1〜2つ星 → 謝罪・事実の受け止め・具体的な対応",
    },
  ];

  ex.forEach(function (e) {
    // クチコミ
    card(s, e.x, 2.05, cw, 1.72, WHITE);
    s.addText(e.stars, {
      x: e.x + 0.28, y: 2.18, w: 1.3, h: 0.32,
      fontFace: BODY, fontSize: 13, color: e.starColor, isTextBox: true, margin: 0,
    });
    s.addText(e.who, {
      x: e.x + 1.6, y: 2.2, w: cw - 1.9, h: 0.3,
      fontFace: BODY, fontSize: 10.5, bold: true, color: INK3, isTextBox: true, margin: 0,
    });
    s.addText(e.review, {
      x: e.x + 0.28, y: 2.55, w: cw - 0.56, h: 1.1,
      fontFace: BODY, fontSize: 10.5, color: INK, lineSpacing: 16,
      isTextBox: true, margin: 0,
    });

    // 矢印
    s.addText("▼", {
      x: e.x + cw / 2 - 0.3, y: 3.8, w: 0.6, h: 0.3,
      fontFace: BODY, fontSize: 12, color: PINE, align: "center", isTextBox: true, margin: 0,
    });

    // 返信案
    card(s, e.x, 4.14, cw, 2.05, MOSS);
    s.addText("AIが作成した返信案", {
      x: e.x + 0.28, y: 4.26, w: cw - 0.56, h: 0.28,
      fontFace: BODY, fontSize: 9.5, bold: true, color: PINE, charSpacing: 1,
      isTextBox: true, margin: 0,
    });
    s.addText(e.reply, {
      x: e.x + 0.28, y: 4.58, w: cw - 0.56, h: 1.5,
      fontFace: BODY, fontSize: 10.5, color: INK, lineSpacing: 16,
      isTextBox: true, margin: 0,
    });

    s.addText(e.tone, {
      x: e.x + 0.28, y: 6.28, w: cw - 0.56, h: 0.32,
      fontFace: BODY, fontSize: 10, color: INK3, isTextBox: true, margin: 0,
    });
  });

  footer(s, 5);
  s.addNotes("返金や補償の約束はしません。事実の創作もしません。制約として組み込んであります。");
}

// =====================================================================
// 6. 使い方 3ステップ
// =====================================================================
{
  const s = pres.addSlide();
  s.background = { color: SURF };
  heading(s, "読む、直す、押す。それだけです", "専門知識は要りません。パソコンでもスマートフォンでも同じように使えます");

  const steps = [
    ["開く", "配られたURLを開き、パスコードを入力します。Googleアカウントは必要ありません。"],
    ["読んで、必要なら直す", "AIの返信案がすでに入っています。そのままでよければ何もしません。書き換えもその場でできます。"],
    ["公開する", "ボタンを押すとGoogleマップに反映されます。返信しないクチコミは片付けられます。"],
  ];

  const cw = (W - M * 2 - 0.6) / 3;
  steps.forEach(function (st, i) {
    const x = M + i * (cw + 0.3);
    card(s, x, 2.1, cw, 2.6);
    chip(s, x + 0.4, 2.45, String(i + 1));
    s.addText(st[0], {
      x: x + 0.4, y: 3.05, w: cw - 0.8, h: 0.5,
      fontFace: HEAD, fontSize: 18, bold: true, color: INK, isTextBox: true, margin: 0,
    });
    s.addText(st[1], {
      x: x + 0.4, y: 3.6, w: cw - 0.8, h: 1.0,
      fontFace: BODY, fontSize: 11.5, color: INK2, lineSpacing: 18,
      isTextBox: true, margin: 0,
    });
  });

  card(s, M, 5.1, W - M * 2, 1.05, WARNBG);
  s.addText("スタッフの方はGoogleアカウント不要です。配布するパスコードだけで使えます。退職時はパスコードを作り直すだけで、その方は入れなくなります。", {
    x: M + 0.35, y: 5.32, w: W - M * 2 - 0.7, h: 0.65,
    fontFace: BODY, fontSize: 12, color: WARN, lineSpacing: 19,
    isTextBox: true, margin: 0,
  });

  footer(s, 6);
}

// =====================================================================
// 7. 安全設計
// =====================================================================
{
  const s = pres.addSlide();
  s.background = { color: SURF };
  heading(s, "「AIが勝手なことを書く」が起きない理由", "返信はGoogleマップに残り続けます。取り返しがつかないからこそ、止まる仕組みを先に入れてあります");

  const facts = [
    ["全件が下書きで止まる", "自動公開は既定で切ってあります。人が押さないかぎり1件も出ません。"],
    ["返金や補償を約束しない", "金銭の判断はホテル様のものです。AIには書かせない制約を入れています。"],
    ["危ないクチコミは隔離する", "低評価、衛生・盗難・法的措置の主張、返金要求は「要確認」に分けます。"],
    ["事実を作らない", "いただいた情報にない設備・サービス・スタッフ名には触れません。"],
  ];

  const cw = (W - M * 2 - 0.4) / 2;
  const ch = 1.5;
  facts.forEach(function (f, i) {
    const x = M + (i % 2) * (cw + 0.4);
    const y = 2.15 + Math.floor(i / 2) * (ch + 0.35);
    card(s, x, y, cw, ch);
    s.addShape(pres.ShapeType.roundRect, {
      x: x + 0.32, y: y + 0.3, w: 0.36, h: 0.36,
      fill: { color: PINE }, rectRadius: 0.09, line: { color: PINE, width: 0 },
    });
    s.addText("✓", {
      x: x + 0.32, y: y + 0.3, w: 0.36, h: 0.36,
      fontFace: BODY, fontSize: 13, bold: true, color: WHITE,
      align: "center", valign: "middle", isTextBox: true, margin: 0,
    });
    s.addText(f[0], {
      x: x + 0.86, y: y + 0.26, w: cw - 1.2, h: 0.42,
      fontFace: HEAD, fontSize: 15, bold: true, color: INK, isTextBox: true, margin: 0,
    });
    s.addText(f[1], {
      x: x + 0.86, y: y + 0.72, w: cw - 1.2, h: 0.65,
      fontFace: BODY, fontSize: 11, color: INK2, lineSpacing: 17,
      isTextBox: true, margin: 0,
    });
  });

  s.addText("インドネシア語は現地の言い回しをAIに任せきれないため、自動公開の対象から外しています。", {
    x: M, y: 5.95, w: W - M * 2, h: 0.4,
    fontFace: BODY, fontSize: 11, color: INK3, isTextBox: true, margin: 0,
  });

  footer(s, 7);
}

// =====================================================================
// 8. 費用
// =====================================================================
{
  const s = pres.addSlide();
  s.background = { color: SURF };
  heading(s, "運用費は月額0円です", "すべて無料枠に収まるよう設計しました。従量課金で青天井になる部分はありません");

  // 大きな数字（1行にまとめる。枠からはみ出さない高さを確保）
  card(s, M, 2.1, 4.3, 3.1, WHITE);
  s.addText(
    [
      { text: "0", options: { fontSize: 80, bold: true, color: PINE, fontFace: HEAD } },
      { text: "  円 / 月", options: { fontSize: 22, bold: true, color: INK, fontFace: HEAD } },
    ],
    {
      x: M, y: 2.8, w: 4.3, h: 1.8,
      align: "center", valign: "middle", isTextBox: true, margin: 0,
    }
  );
  s.addText("ホテル様のご負担はありません", {
    x: M, y: 4.62, w: 4.3, h: 0.4,
    fontFace: BODY, fontSize: 11.5, color: INK3,
    align: "center", isTextBox: true, margin: 0,
  });

  const rows = [
    [{ text: "内訳", options: { bold: true, color: INK3, fontSize: 10 } },
     { text: "役割", options: { bold: true, color: INK3, fontSize: 10 } },
     { text: "月額", options: { bold: true, color: INK3, fontSize: 10, align: "right" } }],
    ["サーバー", "画面の表示", "0円"],
    ["データベース", "クチコミと返信の保存", "0円"],
    ["定期取得", "毎時間の自動チェック", "0円"],
    ["Google連携", "クチコミの取得・返信の投稿", "0円"],
    ["AI（返信案の作成）", "月71件まで", "0円"],
  ].map(function (r, i) {
    if (i === 0) return r;
    return [
      { text: r[0], options: { color: INK, fontSize: 11.5 } },
      { text: r[1], options: { color: INK2, fontSize: 11.5 } },
      { text: r[2], options: { color: PINE, fontSize: 11.5, bold: true, align: "right" } },
    ];
  });

  s.addTable(rows, {
    x: M + 4.7, y: 2.1, w: W - M * 2 - 4.7,
    colW: [2.2, 3.3, 1.3],
    border: { type: "solid", color: LINE, pt: 1 },
    fill: { color: WHITE },
    fontFace: BODY,
    rowH: 0.44,
    valign: "middle",
    margin: 0.08,
  });

  s.addText("AIの利用分は無料枠の範囲で自動的に停止します。上限に達してもクチコミの取得は続き、手動での返信は可能です。上限は毎月1日にリセットされます。", {
    x: M + 4.7, y: 5.35, w: W - M * 2 - 4.7, h: 0.8,
    fontFace: BODY, fontSize: 10.5, color: INK3, lineSpacing: 17,
    isTextBox: true, margin: 0,
  });

  footer(s, 8);
  s.addNotes("返信量を増やしたい場合は月数百円程度で拡張できます。");
}

// =====================================================================
// 9. 導入スケジュール
// =====================================================================
{
  const s = pres.addSlide();
  s.background = { color: SURF };
  heading(s, "ご承認をいただいてから、約1か月", "システムはすでに完成しています。待ち時間のほとんどはGoogle社の審査です");

  const tl = [
    ["完了済み", "システムの開発・検証", "画面、AIの返信生成、データベース、セキュリティまで構築と動作確認を終えています。", PINE],
    ["1日目", "Google社へ利用申請", "クチコミの取得・返信にはGoogle社の承認が必要です。申請はこちらで行います。", PINE],
    ["数日〜数週間", "審査待ち", "Google社の審査期間です。この間、ホテル様にしていただくことはありません。", INK3],
    ["承認後 30分", "接続とお引き渡し", "Hoshi Jungle様のアカウントで接続し、スタッフ用パスコードをお渡しします。当日から使えます。", BRASS],
  ];

  let y = 2.1;
  tl.forEach(function (t) {
    s.addShape(pres.ShapeType.roundRect, {
      x: M, y: y + 0.06, w: 1.85, h: 0.42,
      fill: { color: t[3] === INK3 ? "E7ECE6" : t[3] }, rectRadius: 0.1,
      line: { color: t[3] === INK3 ? LINE : t[3], width: 1 },
    });
    s.addText(t[0], {
      x: M, y: y + 0.06, w: 1.85, h: 0.42,
      fontFace: BODY, fontSize: 10.5, bold: true,
      color: t[3] === INK3 ? INK2 : WHITE,
      align: "center", valign: "middle", isTextBox: true, margin: 0,
    });
    s.addText(t[1], {
      x: M + 2.15, y: y, w: 3.4, h: 0.42,
      fontFace: HEAD, fontSize: 15, bold: true, color: INK, isTextBox: true, margin: 0,
    });
    s.addText(t[2], {
      x: M + 5.7, y: y + 0.02, w: W - M - 5.7 - M, h: 0.7,
      fontFace: BODY, fontSize: 11, color: INK2, lineSpacing: 17,
      isTextBox: true, margin: 0,
    });
    y += 1.05;
    if (t !== tl[tl.length - 1]) {
      s.addShape(pres.ShapeType.line, {
        x: M, y: y - 0.16, w: W - M * 2, h: 0, line: { color: LINE, width: 1 },
      });
    }
  });

  footer(s, 9);
}

// =====================================================================
// 10. お願い
// =====================================================================
{
  const s = pres.addSlide();
  s.background = { color: DARK };

  s.addText("ご承認いただけましたら、3点だけお願いします", {
    x: M, y: 0.85, w: 11.5, h: 0.75,
    fontFace: HEAD, fontSize: 30, bold: true, color: WHITE, isTextBox: true, margin: 0,
  });

  const asks = [
    ["Googleアカウントの確認", "ビジネスプロフィールを管理しているアカウントのメールアドレス。システムはHoshi Jungle様のアカウントで動かします。担当者が変わっても止まらない形にするためです。"],
    ["設定作業の代行可否", "ご希望の場合は leavesbali@gmail.com を管理者として追加していただきます。パスワードをお伺いすることはありません。いつでも解除できます。"],
    ["返信に使う情報", "署名の名前、低評価時のご連絡先、お客様に伝えたい魅力を2〜3つ。これがAIの書ける範囲になります。"],
  ];

  let y = 2.05;
  asks.forEach(function (a, i) {
    s.addShape(pres.ShapeType.roundRect, {
      x: M, y: y + 0.04, w: 0.44, h: 0.44,
      fill: { color: "6FC7A1" }, rectRadius: 0.11, line: { color: "6FC7A1", width: 0 },
    });
    s.addText(String(i + 1), {
      x: M, y: y + 0.04, w: 0.44, h: 0.44,
      fontFace: HEAD, fontSize: 15, bold: true, color: DARK,
      align: "center", valign: "middle", isTextBox: true, margin: 0,
    });
    s.addText(a[0], {
      x: M + 0.72, y: y, w: 3.4, h: 0.45,
      fontFace: HEAD, fontSize: 17, bold: true, color: WHITE, isTextBox: true, margin: 0,
    });
    s.addText(a[1], {
      x: M + 4.3, y: y + 0.02, w: W - M - 4.3 - M, h: 1.0,
      fontFace: BODY, fontSize: 11.5, color: "AFC2B4", lineSpacing: 18,
      isTextBox: true, margin: 0,
    });
    y += 1.32;
  });

  s.addShape(pres.ShapeType.line, {
    x: M, y: 6.15, w: W - M * 2, h: 0, line: { color: "2E4638", width: 1 },
  });
  s.addText("Leaves Bali", {
    x: M, y: 6.35, w: 5.4, h: 0.35,
    fontFace: BODY, fontSize: 12, bold: true, color: "6FC7A1", isTextBox: true, margin: 0,
  });
  s.addText("Hoshi Jungle Review AI — ご提案資料", {
    x: W - M - 5.4, y: 6.35, w: 5.4, h: 0.35,
    fontFace: BODY, fontSize: 11, color: INK3, align: "right", isTextBox: true, margin: 0,
  });

  s.addNotes("①だけでも先にいただければ、Google社への申請準備を始められます。");
}

pres.writeFile({ fileName: "/tmp/claude-0/hoshi-jungle-proposal.pptx" }).then(function (f) {
  console.log("作成:", f);
});
