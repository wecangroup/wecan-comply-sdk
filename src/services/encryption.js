import stringify from 'json-stable-stringify';
import { createMessage, decrypt, encrypt, readKey, readMessage } from 'openpgp';
import { getWorkspaceKeys } from './key-store';

// Get crypto API that works in both browser and Node.js
function getCrypto() {
  // Try globalThis first (Node.js 19+ and modern browsers)
  if (typeof globalThis !== 'undefined' && globalThis.crypto) {
    return globalThis.crypto;
  }
  // Fallback to window (browser)
  if (typeof window !== 'undefined' && window.crypto) {
    return window.crypto;
  }
  // Fallback for Node.js
  if (typeof require !== 'undefined') {
    try {
      const nodeCrypto = require('crypto');
      // Use webcrypto if available (Node.js 15+)
      if (nodeCrypto.webcrypto) {
        return nodeCrypto.webcrypto;
      }
      // For older Node.js, create a polyfill
      return {
        getRandomValues: (arr) => {
          const randomBytes = nodeCrypto.randomBytes(arr.length);
          arr.set(randomBytes);
          return arr;
        },
        subtle: nodeCrypto.webcrypto?.subtle || {
          digest: async (algorithm, data) => {
            const algo = algorithm.toLowerCase().replace('-', '');
            const hash = nodeCrypto.createHash(algo);
            // Convert ArrayBuffer to Buffer if needed
            const buffer = Buffer.from(data);
            hash.update(buffer);
            const digest = hash.digest();
            // Return as ArrayBuffer
            return digest.buffer.slice(digest.byteOffset, digest.byteOffset + digest.byteLength);
          }
        }
      };
    } catch (e) {
      // crypto module not available
    }
  }
  throw new Error('Crypto API not available');
}

const crypto = getCrypto();

function stringToArrayBuffer(str) {
  const encoder = new TextEncoder('utf-8');
  return encoder.encode(str);
}

function uint8ArrayToHexString(byteArray) {
  return Array.from(byteArray, byte => byte.toString(16).padStart(2, '0')).join(
    '',
  );
}

function hexStringToUint8Array(hexString) {
  return new Uint8Array(
    hexString.match(/.{1,2}/g).map(byte => parseInt(byte, 16)),
  );
}

function getPadSize(stringLength, blockSize) {
  // +1 because we need 1 byte to embed the padding size
  return blockSize - ((stringLength + 1) % blockSize) || 0;
}

export function padData(data, blockSize = 64) {
  const string = stringify(data);
  const padSize = getPadSize(string.length, blockSize);
  const dataBuffer = stringToArrayBuffer(string);
  const padding = new Uint8Array(padSize);
  crypto.getRandomValues(padding);
  const paddedArray = new Uint8Array(dataBuffer.length + padSize + 1);
  paddedArray.set(dataBuffer);
  paddedArray.set(padding, dataBuffer.length);
  paddedArray[dataBuffer.length + padSize] = padSize + 1;
  return uint8ArrayToHexString(paddedArray);
}

export function unpadData(hexString) {
  const paddedArray = hexStringToUint8Array(hexString);
  const padSize = paddedArray[paddedArray.length - 1];
  const dataArray = paddedArray.slice(0, -padSize);
  const decoder = new TextDecoder('utf-8');
  return JSON.parse(decoder.decode(dataArray));
}

export async function hashData(data) {
  const dataBuffer = stringToArrayBuffer(stringify(data));
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
  return uint8ArrayToHexString(new Uint8Array(hashBuffer));
}

export async function decryptForMyWorkspace(
  workspaceUuid,
  data,
  format = 'text',
) {
  if (!data) {
    throw new Error('Cannot decrypt: message must be non-empty');
  }

  if (!['text', 'binary'].includes(format)) {
    throw new Error('Message format must either be "text" or "binary"');
  }

  const { private: privateKeyArmored } = getWorkspaceKeys(workspaceUuid);

  if (!privateKeyArmored) {
    throw new Error('Cannot decrypt: no private key available');
  }

  // Parse the private key from armored format
  const privateKey = await readKey({ armoredKey: privateKeyArmored });

  const message = await readMessage({
    armoredMessage: data,
  });

  const { data: decrypted } = await decrypt({
    message,
    decryptionKeys: [privateKey],
    format: format === 'text' ? 'utf8' : 'binary',
  });

  if (!decrypted) {
    return decrypted;
  }

  if (format === 'text') {
    return JSON.parse(decrypted);
  }

  return decrypted;
}

export async function encryptForKeys(publicKeys, data, format = 'text') {
  if (!publicKeys?.length) {
    throw new Error('Cannot encrypt: no public keys provided');
  }

  if (data === undefined) {
    throw new Error('Cannot encrypt: undefined data');
  }

  if (!['text', 'binary'].includes(format)) {
    throw new Error('Message format must either be "text" or "binary"');
  }

  if (format === 'text') {
    data = JSON.stringify(data) ?? '';
  }

  const message = await createMessage({
    [format]: data,
    format: format === 'text' ? 'utf8' : 'binary',
  });

  return await encrypt({
    message,
    encryptionKeys: await Promise.all(
      publicKeys.map(key => readKey({ armoredKey: key })),
    ),
  });
}
