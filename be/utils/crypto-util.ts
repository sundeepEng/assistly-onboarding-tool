import { randomBytes, createCipheriv, createDecipheriv } from 'crypto';
import { gzipSync, gunzipSync } from 'zlib';

// Define the type for the user data
type UserData = Record<string, any>;

/**
 * Configuration constants
 */
const IV_LENGTH = 12; // Recommended length for GCM
const AUTH_TAG_LENGTH = 16; // Authentication tag length

/**
 * Get the encryption key from environment variables.
 * It should be a base64-encoded 32-byte key for AES-256-GCM.
 */
const getEncryptionKey = (): Buffer => {
  const keyBase64 = process.env.CRYPTO_ENCRYPTION_KEY!;
  if (!keyBase64) {
    throw new Error('ENCRYPTION_KEY environment variable is not set.');
  }

  const key = Buffer.from(keyBase64, 'base64');

  return key;
};

/**
 * Encrypts the provided plaintext using AES-256-GCM.
 * @param plainText The plaintext string to encrypt.
 * @returns The encrypted data as a base64 string containing IV and auth tag.
 */
export const encrypt = (plainText: string): string => {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv('aes-256-gcm', key, iv);

  let encrypted = cipher.update(plainText, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  const authTag = cipher.getAuthTag();

  // Concatenate IV + Auth Tag + Encrypted Data
  const encryptedBuffer = Buffer.concat([iv, authTag, Buffer.from(encrypted, 'base64')]);
  return encryptedBuffer.toString('base64');
};

/**
 * Decrypts the provided encrypted data using AES-256-GCM.
 * @param encryptedData The encrypted data as a base64 string containing IV and auth tag.
 * @returns The decrypted plaintext string.
 */
export const decrypt = (encryptedData: string): string => {
  const key = getEncryptionKey();
  const encryptedBuffer = Buffer.from(encryptedData, 'base64');

  const iv = encryptedBuffer.subarray(0, IV_LENGTH);
  const authTag = encryptedBuffer.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = encryptedBuffer.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(ciphertext, undefined, 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
};

/**
 * Encrypts sensitive fields in the user object.
 * Excludes specified fields from encryption.
 * @param user The user object to encrypt.
 * @param excludeFields A set of field names to exclude from encryption.
 * @returns A new user object with an 'encryptedData' field.
 */
export const encryptUserData = (
  user: UserData,
  excludeFields: Set<string>,
  compress = false
): UserData => {
  const dataToEncrypt: Record<string, any> = {};
  const dataToKeep: Record<string, any> = {};

  Object.entries(user).forEach(([key, value]) => {
    if (excludeFields.has(key)) {
      dataToKeep[key] = value;
    } else {
      dataToEncrypt[key] = value;
    }
  });

  // If there's nothing to encrypt, return the original user
  if (Object.keys(dataToEncrypt).length === 0) {
    return { ...user };
  }

  let plainText = JSON.stringify(dataToEncrypt);
  if (compress) {
    plainText = gzipSync(Buffer.from(plainText, 'utf8')).toString('base64');
  }

  const encryptedData = encrypt(plainText);

  const result: UserData = {
    ...dataToKeep,
    encryptedData: encryptedData,
  };

  if (compress) {
    result.isCompressed = true;
  }

  return result;
};

/**
 * Decrypts the 'encryptedData' field in the user object.
 * @param user The user object with an 'encryptedData' field.
 * @param excludeFields A set of field names that were excluded from encryption.
 * @returns A new user object with decrypted fields.
 */
export const decryptUserData = (user: UserData): UserData => {
  const { encryptedData, isCompressed, ...dataToKeep } = user;

  // If there's no encryptedData, return the original user
  if (!encryptedData) {
    return { ...user };
  }

  let decryptedData: Record<string, any> = {};
  try {
    let decryptedJson = decrypt(encryptedData);
    if (isCompressed) {
      decryptedJson = gunzipSync(Buffer.from(decryptedJson, 'base64')).toString('utf8');
    }
    decryptedData = JSON.parse(decryptedJson);
  } catch (error) {
    console.error('Failed to decrypt or parse user data:', error);
    throw new Error('Invalid encrypted user data.');
  }

  return {
    ...dataToKeep,
    ...decryptedData,
  };
};
