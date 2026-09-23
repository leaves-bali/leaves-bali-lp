import { chromium } from 'playwright';

const SRC = new URL('./slides.html', import.meta.url).href;
const OUT = new URL('./kuchikomi-reply-ai.pdf', import.meta.url).pathname;

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
});
const page = await browser.newPage();

const errors = [];
page.on('pageerror', (e) => errors.push(e.message));

await page.goto(SRC, { waitUntil: 'load' });
await page.waitForTimeout(1000);

console.log('スライド数:', await page.locator('.slide').count());

// 1280x720 に収まっているか。文字が切れたPDFを配ってしまう事故を防ぐ。
const overflow = await page.evaluate(() => {
  const out = [];
  document.querySelectorAll('.slide').forEach((s, i) => {
    if (s.scrollHeight > 721 || s.scrollWidth > 1281) {
      out.push(`スライド${i + 1}: 領域超過 ${s.scrollWidth}x${s.scrollHeight}`);
    }
    s.querySelectorAll('*').forEach((el) => {
      const r = el.getBoundingClientRect();
      const sr = s.getBoundingClientRect();
      if (r.width && r.height && (r.bottom > sr.bottom + 1 || r.right > sr.right + 1)) {
        out.push(`スライド${i + 1}: はみ出し <${el.className || el.tagName}>`);
      }
    });
  });
  return out;
});
console.log('はみ出し:', overflow.length ? overflow : 'なし');

// スライド枠に収まっていても、ブロック同士が重なることがある。
// 実際に本文と注意書きが14px重なったまま出力しかけたので、専用に検査する。
const overlaps = await page.evaluate(() => {
  const out = [];
  document.querySelectorAll('.slide').forEach((s, i) => {
    const sr = s.getBoundingClientRect();
    const blocks = [...s.querySelectorAll(':scope > .pad')].map((el) => {
      const r = el.getBoundingClientRect();
      return {
        top: Math.round(r.top - sr.top),
        bottom: Math.round(r.bottom - sr.top),
        label: (el.textContent || '').trim().slice(0, 18),
      };
    });
    for (let a = 0; a < blocks.length; a++) {
      for (let c = a + 1; c < blocks.length; c++) {
        const A = blocks[a];
        const B = blocks[c];
        if (A.top < B.bottom && B.top < A.bottom) {
          out.push(`スライド${i + 1}: 「${A.label}」と「${B.label}」が重なっています`);
        }
      }
    }
  });
  return out;
});
console.log('重なり:', overlaps.length ? overlaps : 'なし');
console.log('JSエラー:', errors.length ? errors : 'なし');

await page.pdf({
  path: OUT,
  width: '13.333in',
  height: '7.5in',
  printBackground: true,
  margin: { top: 0, right: 0, bottom: 0, left: 0 },
  preferCSSPageSize: true,
});

await browser.close();
console.log('作成:', OUT);
