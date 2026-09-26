import * as ExpoCrypto from 'expo-crypto';

// Supabase's PKCE implementation expects these two Web Crypto operations.
// Supply native implementations only when absent; do not replace existing crypto.
const nativeCrypto = globalThis.crypto ?? {};
if (typeof globalThis.crypto?.getRandomValues !== 'function') {
  Object.defineProperty(nativeCrypto, 'getRandomValues', { value: ExpoCrypto.getRandomValues, configurable: true });
}
if (!globalThis.crypto?.subtle) {
  Object.defineProperty(nativeCrypto, 'subtle', {
    configurable: true,
    value: {
      digest(algorithm: string | { name: string }, data: Parameters<typeof ExpoCrypto.digest>[1]) {
        const name = typeof algorithm === 'string' ? algorithm : algorithm.name;
        if (name.toUpperCase() !== 'SHA-256') throw new Error('Only SHA-256 is supported by the native PKCE adapter.');
        return ExpoCrypto.digest(ExpoCrypto.CryptoDigestAlgorithm.SHA256, data);
      },
    },
  });
}
if (!globalThis.crypto) Object.defineProperty(globalThis, 'crypto', { value: nativeCrypto, configurable: true });
