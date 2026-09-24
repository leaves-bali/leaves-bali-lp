import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  canPublishDirectly,
  isReviewSource,
  PASTEABLE_SOURCES,
  REVIEW_SOURCES,
  SOURCE_LABELS,
} from '../src/lib/reviews/sources';

/**
 * クチコミの出どころの扱い。
 *
 * ここで守りたいのは「投稿できないサイトに公開ボタンを出さない」こと。
 * 押しても何も起きないボタンは現場では不具合として扱われ、
 * 「公開したつもりで公開されていない」という最悪の勘違いを生む。
 */

test('直接投稿できるのは Google だけ', () => {
  // Booking.com と Expedia には API があるが、認定パートナー限定で
  // Booking.com は新規受付を停止中。実際に投稿できるのは Google のみ。
  assert.equal(canPublishDirectly('google'), true);
  for (const source of REVIEW_SOURCES.filter((s) => s !== 'google')) {
    assert.equal(canPublishDirectly(source), false, `${source} は直接投稿できないはず`);
  }
});

test('貼り付けの選択肢に Google は入らない', () => {
  // Google は自動で取り込まれる。手で足せると二重登録になる。
  assert.ok(!PASTEABLE_SOURCES.includes('google'));
  assert.equal(PASTEABLE_SOURCES.length, REVIEW_SOURCES.length - 1);
});

test('想定外の値をサイトとして受け付けない', () => {
  for (const bad of ['', 'GOOGLE', 'yelp', null, undefined, 1, {}]) {
    assert.equal(isReviewSource(bad), false, `${String(bad)} は拒否すべき`);
  }
  for (const good of REVIEW_SOURCES) {
    assert.equal(isReviewSource(good), true);
  }
});

test('すべてのサイトに表示名がある', () => {
  // 表示名が欠けると画面にコード（trip_com など）がそのまま出る。
  for (const source of REVIEW_SOURCES) {
    assert.ok(SOURCE_LABELS[source], `${source} の表示名が無い`);
    assert.notEqual(SOURCE_LABELS[source], source);
  }
});

test('営業資料で「できない」と伝えたサイトが揃っている', () => {
  // 資料の対応表と実装がずれると、約束と製品が食い違う。
  for (const promised of ['agoda', 'tripadvisor', 'trip_com', 'tabelog'] as const) {
    assert.ok(REVIEW_SOURCES.includes(promised), `${promised} が実装に無い`);
    assert.equal(canPublishDirectly(promised), false);
  }
});
