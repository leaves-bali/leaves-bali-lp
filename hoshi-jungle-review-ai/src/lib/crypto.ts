import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

import { env } from '@/lib/env';

/**
 * Google の refresh_token を DB に保存するための AES-256-GCM 暗号化。
 *
 * refresh_token は「そのユーザーの Google ビジネスプロフィールを操作できる永続的な鍵」であり、
 * DB ダンプが漏れた時点で終わる種類の秘密である。平文で置かない。
 *
 * 保存形式: base64(iv):base64(ciphertext):base64(authTag)
 */

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // GCM の推奨 nonce 長

function getKey(): Buffer {
  const key = Buffer.from(env.tokenEncryptionKey, 'base64');
  if (key.length !== 32) {
    throw new Error(
      'TOKEN_ENCRYPTION_KEY は base64 エンコードされた 32 バイト鍵である必要があります。' +
        '生成: openssl rand -base64 32',
    );
  }
  return key;
}

export function encryptToken(plaintext: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return [
    iv.toString('base64'),
    ciphertext.toString('base64'),
    authTag.toString('base64'),
  ].join(':');
}

export function decryptToken(payload: string): string {
  const parts = payload.split(':');
  if (parts.length !== 3) {
    throw new Error('暗号化トークンの形式が不正です。');
  }
  const [ivB64, ciphertextB64, authTagB64] = parts;
  const decipher = createDecipheriv(
    ALGORITHM,
    getKey(),
    Buffer.from(ivB64, 'base64'),
  );
  decipher.setAuthTag(Buffer.from(authTagB64, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextB64, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}
