import { randomBytes, randomInt, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
  options: { N: number; r: number; p: number; maxmem: number },
) => Promise<Buffer>;

/**
 * スタッフ用パスコードの生成・ハッシュ・検証。
 *
 * scrypt を使う理由: Node の標準ライブラリだけで完結し、依存を増やさずに
 * メモリハード（GPU による総当たりに強い）なハッシュが得られるため。
 * bcrypt/argon2 はネイティブビルドが必要で、Vercel のビルドを不安定にする。
 */

// OWASP の推奨値に沿ったパラメータ。N=2^15 は Vercel の関数でも 100ms 程度で収まる。
const SCRYPT_N = 32768;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LENGTH = 32;
const SALT_LENGTH = 16;
// scrypt は 128 * N * r バイトを使う。既定の maxmem (32MB) を超えるので明示的に上げる。
const MAX_MEM = 128 * SCRYPT_N * SCRYPT_R * 2;

/**
 * 紛らわしい文字を除いた 30 文字のアルファベット（Crockford Base32 の考え方に準拠）。
 * フロントで紙に書き写し、電話や口頭で伝える運用を想定しているため、
 *   0 / O、1 / I / L … 見間違い
 *   U             … 読み上げ時の取り違えと、意図しない不適切な語の生成を避ける
 * を除外している。
 */
const ALPHABET = 'ABCDEFGHJKMNPQRSTVWXYZ23456789';

/**
 * パスコードを生成する。形式: HJ-XXXX-XXXX（30 種類 × 8 文字 = 約 39 ビット）
 *
 * 約 6,500 億通り。単体では強力とは言えないが、
 *   - 照合 1 回あたり scrypt の約 100ms が必ずかかる
 *   - IP 単位で 15 分あたり 10 回失敗すると遮断される
 * の 2 点により、総当たりは現実的な時間で完了しない。
 * 現場で読み上げ・書き写しができる長さとのバランスを取った結果。
 */
export function generatePasscode(): string {
  const pick = () =>
    Array.from({ length: 4 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('');
  return `HJ-${pick()}-${pick()}`;
}

/** 入力の揺れ（小文字・全角ハイフン・スペース）を吸収する。 */
export function normalizePasscode(input: string): string {
  return input
    .trim()
    .toUpperCase()
    .replace(/[‐-―−－]/g, '-') // 各種ダッシュ → ASCII ハイフン
    .replace(/[\s　]/g, '');
}

export async function hashPasscode(passcode: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const derived = await scryptAsync(normalizePasscode(passcode), salt, KEY_LENGTH, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
    maxmem: MAX_MEM,
  });
  return [
    'scrypt',
    SCRYPT_N,
    SCRYPT_R,
    SCRYPT_P,
    salt.toString('base64'),
    derived.toString('base64'),
  ].join('$');
}

export async function verifyPasscode(passcode: string, stored: string): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;

  const [, nRaw, rRaw, pRaw, saltB64, hashB64] = parts;
  const N = Number.parseInt(nRaw, 10);
  const r = Number.parseInt(rRaw, 10);
  const p = Number.parseInt(pRaw, 10);
  if (!Number.isFinite(N) || !Number.isFinite(r) || !Number.isFinite(p)) return false;

  const expected = Buffer.from(hashB64, 'base64');

  let derived: Buffer;
  try {
    derived = await scryptAsync(
      normalizePasscode(passcode),
      Buffer.from(saltB64, 'base64'),
      expected.length,
      { N, r, p, maxmem: 128 * N * r * 2 },
    );
  } catch {
    return false;
  }

  // 長さが違うと timingSafeEqual が例外を投げるので先に比較する
  if (derived.length !== expected.length) return false;
  return timingSafeEqual(derived, expected);
}
