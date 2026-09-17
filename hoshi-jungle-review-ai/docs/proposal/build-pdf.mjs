import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await b.newPage();
const errs = [];
p.on('pageerror', e => errs.push(e.message));
await p.goto('file:///tmp/claude-0/slides.built.html', { waitUntil: 'load' });
await p.waitForTimeout(1200);

const n = await p.locator('.slide').count();
console.log('スライド数:', n);

// 各スライドが 1280x720 に収まっているか（はみ出し検査）
const over = await p.evaluate(() => {
  const out = [];
  document.querySelectorAll('.slide').forEach((s, i) => {
    if (s.scrollHeight > 721 || s.scrollWidth > 1281) {
      out.push(`スライド${i + 1}: ${s.scrollWidth}x${s.scrollHeight}`);
    }
    s.querySelectorAll('*').forEach(el => {
      const r = el.getBoundingClientRect();
      const sr = s.getBoundingClientRect();
      if (r.width && r.height && (r.bottom > sr.bottom + 1 || r.right > sr.right + 1)) {
        out.push(`スライド${i + 1}: はみ出し <${el.className || el.tagName}>`);
      }
    });
  });
  return out;
});
console.log('はみ出し:', over.length ? over : 'なし');
console.log('JSエラー:', errs.length ? errs : 'なし');

await p.pdf({
  path: '/tmp/claude-0/hoshi-jungle-proposal.pdf',
  width: '13.333in', height: '7.5in',
  printBackground: true, margin: { top: 0, right: 0, bottom: 0, left: 0 },
  preferCSSPageSize: true,
});
await b.close();
