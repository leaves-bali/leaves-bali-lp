import assert from 'node:assert/strict';
import { test } from 'node:test';

import { resolveLocationPlan } from '../src/lib/settings/locationPlan';

/**
 * 契約しているオプションの判定。
 *
 * ここで守りたいのは「迷ったら無効に倒す」こと。
 * 誤って有効になると、契約していない店に課金対象の機能を使わせてしまう。
 * 逆に誤って無効になっても、問い合わせを受けて直せば済む。
 */

test('明示的に true のときだけ有効になる', () => {
  const plan = resolveLocationPlan({ report_enabled: true, other_sites_enabled: true });
  assert.equal(plan.reportEnabled, true);
  assert.equal(plan.otherSitesEnabled, true);
});

test('false なら無効', () => {
  const plan = resolveLocationPlan({ report_enabled: false, other_sites_enabled: false });
  assert.equal(plan.reportEnabled, false);
  assert.equal(plan.otherSitesEnabled, false);
});

test('判断がつかない値はすべて無効に倒す', () => {
  // null（列が無い古い行）、undefined（select し忘れ）、行そのものが取れない場合。
  // どれも「契約している」と解釈してはいけない。
  for (const row of [null, undefined, {}, { report_enabled: null, other_sites_enabled: null }]) {
    const plan = resolveLocationPlan(row as never);
    assert.equal(plan.reportEnabled, false, `${JSON.stringify(row)} は無効であるべき`);
    assert.equal(plan.otherSitesEnabled, false, `${JSON.stringify(row)} は無効であるべき`);
  }
});

test('オプションは独立している', () => {
  // 片方だけ契約している店が普通にある。
  const onlyReport = resolveLocationPlan({ report_enabled: true, other_sites_enabled: false });
  assert.equal(onlyReport.reportEnabled, true);
  assert.equal(onlyReport.otherSitesEnabled, false);

  const onlySites = resolveLocationPlan({ report_enabled: false, other_sites_enabled: true });
  assert.equal(onlySites.reportEnabled, false);
  assert.equal(onlySites.otherSitesEnabled, true);
});
