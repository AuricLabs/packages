import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

import { InternalServerError } from 'http-errors-enhanced';

import { CoreErrorCodes } from '../errors';
import { tryGetResource } from '../lib';

export const encryptionService = {
  get encryptionKey(): string {
    const secret = tryGetResource<string>('EncryptionKey.value');
    if (!secret) {
      throw new InternalServerError(CoreErrorCodes.CORE_ENCRYPTION_KEY_NOT_FOUND);
    }
    return secret;
  },

  encrypt(secret: string): string {
    const keyBuffer = Buffer.from(this.encryptionKey, 'base64');
    const iv = randomBytes(12); // 12 bytes for GCM
    const cipher = createCipheriv('aes-256-gcm', keyBuffer, iv);
    const encrypted = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();

    // Combine all components into a single string with colons as separators
    return `${iv.toString('base64')}:${encrypted.toString('base64')}:${tag.toString('base64')}`;
  },

  decrypt(encryptedString: string): string {
    const [ivBase64, dataBase64, tagBase64] = encryptedString.split(':');
    if (!ivBase64 || !dataBase64 || !tagBase64) {
      throw new InternalServerError(CoreErrorCodes.CORE_ENCRYPTION_INVALID_FORMAT, {
        encryptedString,
      });
    }

    const keyBuffer = Buffer.from(this.encryptionKey, 'base64');
    const decipher = createDecipheriv('aes-256-gcm', keyBuffer, Buffer.from(ivBase64, 'base64'));
    decipher.setAuthTag(Buffer.from(tagBase64, 'base64'));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(dataBase64, 'base64')),
      decipher.final(),
    ]);
    return decrypted.toString('utf8');
  },
};
