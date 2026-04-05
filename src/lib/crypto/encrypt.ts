import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';

function getKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key || key.length !== 64) {
    throw new Error('ENCRYPTION_KEY must be a 64-character hex string (32 bytes)');
  }
  return Buffer.from(key, 'hex');
}

export interface EncryptedData {
  encrypted: Buffer;
  iv: string;
  authTag: string;
}

// Encrypt data using AES-256-GCM
export function encrypt(data: Buffer): EncryptedData {
  const key = getKey();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    encrypted,
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex'),
  };
}

// Decrypt data using AES-256-GCM
export function decrypt(encrypted: Buffer, ivHex: string, authTagHex: string): Buffer {
  const key = getKey();
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  return Buffer.concat([decipher.update(encrypted), decipher.final()]);
}

// Encrypt a string (for storing parsed JSON data)
export function encryptString(text: string): { encrypted: string; iv: string; authTag: string } {
  const result = encrypt(Buffer.from(text, 'utf-8'));
  return {
    encrypted: result.encrypted.toString('base64'),
    iv: result.iv,
    authTag: result.authTag,
  };
}

// Decrypt a string
export function decryptString(encryptedBase64: string, ivHex: string, authTagHex: string): string {
  const encrypted = Buffer.from(encryptedBase64, 'base64');
  const decrypted = decrypt(encrypted, ivHex, authTagHex);
  return decrypted.toString('utf-8');
}
