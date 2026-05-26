import stringify from 'json-stable-stringify';
import { createMessage, decrypt, encrypt, readPrivateKey, readKey, readMessage } from 'openpgp';
import { getWorkspaceKeys } from './key-store.js';

type CryptoLike = Pick<Crypto, 'getRandomValues' | 'subtle'>;
type ReaderResult<T> = { done: boolean; value?: T };
type ReaderLike<T> = { read(): Promise<ReaderResult<T>> };
type StreamLike<T> = { getReader(): ReaderLike<T> };

// Get crypto API that works in both browser and Node.js
function getCrypto(): CryptoLike {
  // Try globalThis first (Node.js 19+ and modern browsers)
  if (typeof globalThis !== 'undefined' && globalThis.crypto) {
    return globalThis.crypto;
  }

  // Fallback to window (browser)
  if (typeof window !== 'undefined' && window.crypto) {
    return window.crypto;
  }

  throw new Error('Crypto API not available');
}

const crypto = getCrypto();

function stringToUint8Array(str: string): Uint8Array {
  const encoder = new TextEncoder();
  return encoder.encode(str);
}

export function toArrayBuffer(data: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(data.byteLength);
  new Uint8Array(buffer).set(data);
  return buffer;
}

function isReadableStream<T>(value: unknown): value is StreamLike<T> {
  return typeof value === 'object' && value !== null && 'getReader' in value;
}

async function readText(value: unknown): Promise<string> {
  if (typeof value === 'string') {
    return value;
  }

  if (!isReadableStream<string>(value)) {
    throw new TypeError('Expected encrypted text result to be a string or stream');
  }

  const reader = value.getReader();
  const chunks: string[] = [];
  while (true) {
    const { done, value: chunk } = await reader.read();
    if (done) {
      break;
    }
    if (chunk === undefined) {
      throw new TypeError('Expected text stream chunk');
    }
    chunks.push(chunk);
  }
  return chunks.join('');
}

async function readBinary(value: unknown): Promise<Uint8Array> {
  if (!isReadableStream<Uint8Array>(value)) {
    if (value instanceof Uint8Array) {
      return value;
    }
    throw new TypeError('Expected encrypted binary result to be bytes or stream');
  }

  const reader = value.getReader();
  const chunks: Uint8Array[] = [];
  let totalLength = 0;
  while (true) {
    const { done, value: chunk } = await reader.read();
    if (done) {
      break;
    }
    if (chunk === undefined) {
      throw new TypeError('Expected binary stream chunk');
    }
    chunks.push(chunk);
    totalLength += chunk.byteLength;
  }

  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result;
}

function uint8ArrayToHexString(byteArray: Uint8Array): string {
  return Array.from(byteArray, byte => byte.toString(16).padStart(2, '0')).join('');
}

function hexStringToUint8Array(hexString: string): Uint8Array {
  return new Uint8Array(
    (hexString.match(/.{1,2}/g) ?? []).map(byte => parseInt(byte, 16)),
  );
}

function getPadSize(stringLength: number, blockSize: number): number {
  // +1 because we need 1 byte to embed the padding size
  return blockSize - ((stringLength + 1) % blockSize) || 0;
}

export function padData(data: unknown, blockSize = 64): string {
  const string = stringify(data) ?? '';
  const padSize = getPadSize(string.length, blockSize);
  const dataBuffer = stringToUint8Array(string);
  const padding = new Uint8Array(padSize);
  crypto.getRandomValues(padding);
  const paddedArray = new Uint8Array(dataBuffer.length + padSize + 1);
  paddedArray.set(dataBuffer);
  paddedArray.set(padding, dataBuffer.length);
  paddedArray[dataBuffer.length + padSize] = padSize + 1;
  return uint8ArrayToHexString(paddedArray);
}

export function unpadData<T = string>(hexString: string): T {
  const paddedArray = hexStringToUint8Array(hexString);
  const padSize = paddedArray[paddedArray.length - 1];
  const dataArray = paddedArray.slice(0, -padSize);
  const decoder = new TextDecoder();
  return JSON.parse(decoder.decode(dataArray)) as T;
}

export async function hashData(data: unknown): Promise<string> {
  const dataBuffer = stringToUint8Array(stringify(data) ?? '');
  const hashBuffer = await crypto.subtle.digest('SHA-256', toArrayBuffer(dataBuffer));
  return uint8ArrayToHexString(new Uint8Array(hashBuffer));
}

export async function decryptForMyWorkspace<T = string>(
  workspaceUuid: string,
  data: string,
  format?: 'text',
): Promise<T>;
export async function decryptForMyWorkspace(
  workspaceUuid: string,
  data: string,
  format: 'binary',
): Promise<Uint8Array>;
export async function decryptForMyWorkspace<T = string>(
  workspaceUuid: string,
  data: string,
  format: 'text' | 'binary' = 'text',
): Promise<T | Uint8Array> {
  if (!data) {
    throw new Error('Cannot decrypt: message must be non-empty');
  }

  const { private: privateKeyArmored } = getWorkspaceKeys(workspaceUuid);
  if (!privateKeyArmored) {
    throw new Error('Cannot decrypt: no private key available');
  }

  // Parse the private key from armored format
  const privateKey = await readPrivateKey({ armoredKey: privateKeyArmored });
  const message = await readMessage({ armoredMessage: data });
  if (format === 'text') {
    const { data: decrypted } = await decrypt({
      message,
      decryptionKeys: [privateKey],
      format: 'utf8',
    });
    return JSON.parse(await readText(decrypted)) as T;
  }

  const { data: decrypted } = await decrypt({
    message,
    decryptionKeys: [privateKey],
    format: 'binary',
  });
  return readBinary(decrypted);
}

export async function encryptForKeys(
  publicKeys: string[],
  data: unknown,
  format?: 'text',
): Promise<string>;
export async function encryptForKeys(
  publicKeys: string[],
  data: string | Uint8Array,
  format: 'binary',
): Promise<Uint8Array>;
export async function encryptForKeys(
  publicKeys: string[],
  data: unknown,
  format: 'text' | 'binary' = 'text',
): Promise<string | Uint8Array> {
  if (!publicKeys.length) {
    throw new Error('Cannot encrypt: no public keys provided');
  }

  if (data === undefined) {
    throw new Error('Cannot encrypt: undefined data');
  }

  const encryptionKeys = await Promise.all(
    publicKeys.map(key => readKey({ armoredKey: key })),
  );

  if (format === 'text') {
    const message = await createMessage({
      text: JSON.stringify(data) ?? '',
      format: 'utf8',
    });
    return readText(await encrypt({
      message,
      format: 'armored',
      encryptionKeys,
    }));
  }

  const message = await createMessage({
    binary: data as Uint8Array,
    format: 'binary',
  });
  // Keep armored output so decryptForMyWorkspace (which reads armoredMessage) stays consistent
  const armored = await readText(await encrypt({
    message,
    format: 'armored',
    encryptionKeys,
  }));
  return new TextEncoder().encode(armored);
}
