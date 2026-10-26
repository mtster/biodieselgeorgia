/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { User } from '../types';

const DB_NAME = 'biodiesel_pwa_auth_db';
const DB_VERSION = 1;
const STORE_NAME = 'auth_kv';

const KEY_CACHED_USER = 'biodiesel_cached_user';
const KEY_CREDENTIALS = 'biodiesel_auth_vault';
const KEY_EXPLICIT_LOGOUT = 'biodiesel_explicit_logout';

// In-memory synchronous cache for immediate, zero-latency access
const memoryStore = new Map<string, string>();

// Initialize memory store from localStorage synchronously on module load
if (typeof window !== 'undefined' && window.localStorage) {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && (k.startsWith('sb-') || k.startsWith('biodiesel_'))) {
        const val = localStorage.getItem(k);
        if (val !== null) {
          memoryStore.set(k, val);
        }
      }
    }
  } catch (e) {
    console.debug('Error reading localStorage into memory cache:', e);
  }
}

/**
 * Open IndexedDB safely with strict timeout so it never hangs in restricted iframe/browser environments
 */
function openAuthDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      resolve(null);
      return;
    }

    // Safety timeout: abort IndexedDB opening if blocked or slow (e.g. iframe policy)
    const timer = setTimeout(() => {
      resolve(null);
    }, 500);

    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
      request.onsuccess = () => {
        clearTimeout(timer);
        resolve(request.result);
      };
      request.onerror = () => {
        clearTimeout(timer);
        resolve(null);
      };
      request.onblocked = () => {
        clearTimeout(timer);
        resolve(null);
      };
    } catch {
      clearTimeout(timer);
      resolve(null);
    }
  });
}

/**
 * Get item from IndexedDB with safe timeout
 */
async function idbGet(key: string): Promise<string | null> {
  const db = await openAuthDb();
  if (!db) return null;
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), 400);
    try {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);
      req.onsuccess = () => {
        clearTimeout(timer);
        resolve(req.result !== undefined ? req.result : null);
      };
      req.onerror = () => {
        clearTimeout(timer);
        resolve(null);
      };
    } catch {
      clearTimeout(timer);
      resolve(null);
    }
  });
}

/**
 * Set item in IndexedDB safely in background
 */
async function idbSet(key: string, value: string): Promise<void> {
  const db = await openAuthDb();
  if (!db) return;
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(), 400);
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(value, key);
      req.onsuccess = () => {
        clearTimeout(timer);
        resolve();
      };
      req.onerror = () => {
        clearTimeout(timer);
        resolve();
      };
    } catch {
      clearTimeout(timer);
      resolve();
    }
  });
}

/**
 * Remove item from IndexedDB safely in background
 */
async function idbDel(key: string): Promise<void> {
  const db = await openAuthDb();
  if (!db) return;
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(), 400);
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(key);
      req.onsuccess = () => {
        clearTimeout(timer);
        resolve();
      };
      req.onerror = () => {
        clearTimeout(timer);
        resolve();
      };
    } catch {
      clearTimeout(timer);
      resolve();
    }
  });
}

/**
 * Rehydrate missing keys from IndexedDB into memory & localStorage
 * (Runs asynchronously in the background so it never blocks app boot)
 */
export async function rehydrateFromIndexedDB(): Promise<void> {
  try {
    const db = await openAuthDb();
    if (!db) return;
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.openCursor();
    req.onsuccess = (e) => {
      const cursor = (e.target as IDBRequest).result;
      if (cursor) {
        const k = cursor.key as string;
        const v = cursor.value as string;
        if (!memoryStore.has(k)) {
          memoryStore.set(k, v);
          try {
            if (typeof window !== 'undefined' && window.localStorage) {
              if (localStorage.getItem(k) === null) {
                localStorage.setItem(k, v);
              }
            }
          } catch {}
        }
        cursor.continue();
      }
    };
  } catch (e) {
    console.debug('rehydrateFromIndexedDB error:', e);
  }
}

// Kick off background rehydration asynchronously
if (typeof window !== 'undefined') {
  setTimeout(() => {
    rehydrateFromIndexedDB().catch(() => {});
  }, 100);
}

/**
 * Request durable storage quota from browser
 */
export async function requestPersistentStorage(): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persist) {
    try {
      const isPersisted = await navigator.storage.persisted();
      if (!isPersisted) {
        return await navigator.storage.persist();
      }
      return true;
    } catch (e) {
      console.debug('navigator.storage.persist() error:', e);
    }
  }
  return false;
}

/**
 * Supabase-compatible synchronous persistent storage adapter.
 * Synchronous getItem guarantees zero-blocking execution for GotrueClient.
 * Background writes replicate to IndexedDB for long-term PWA survival against iOS cache sweeps.
 */
export const persistentAuthStorage = {
  getItem: (key: string): string | null => {
    // 1. Check memory store
    if (memoryStore.has(key)) {
      return memoryStore.get(key)!;
    }
    // 2. Check localStorage
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const val = localStorage.getItem(key);
        if (val !== null) {
          memoryStore.set(key, val);
          return val;
        }
      } catch (e) {
        console.debug('localStorage.getItem error:', e);
      }
    }
    return null;
  },

  setItem: (key: string, value: string): void => {
    memoryStore.set(key, value);
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        localStorage.setItem(key, value);
      } catch (e) {
        console.debug('localStorage.setItem error:', e);
      }
    }
    // Fire-and-forget async backup to IndexedDB
    idbSet(key, value).catch(() => {});
  },

  removeItem: (key: string): void => {
    memoryStore.delete(key);
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        localStorage.removeItem(key);
      } catch (e) {
        console.debug('localStorage.removeItem error:', e);
      }
    }
    // Fire-and-forget async removal from IndexedDB
    idbDel(key).catch(() => {});
  }
};

/**
 * Cache current active user profile for immediate zero-latency PWA wake
 */
export function saveCachedUser(user: User | null): void {
  if (!user) {
    persistentAuthStorage.removeItem(KEY_CACHED_USER);
    return;
  }
  const serialized = JSON.stringify(user);
  persistentAuthStorage.setItem(KEY_CACHED_USER, serialized);
}

/**
 * Get synchronously cached user (if not explicitly logged out)
 */
export function getCachedUser(): User | null {
  if (isExplicitlyLoggedOut()) return null;

  try {
    const raw = memoryStore.get(KEY_CACHED_USER) || (typeof window !== 'undefined' && localStorage.getItem(KEY_CACHED_USER));
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.debug('Error getting cached user:', e);
  }
  return null;
}

/**
 * Check if the user explicitly clicked the log out button
 */
export function isExplicitlyLoggedOut(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(KEY_EXPLICIT_LOGOUT) === 'true';
  } catch {
    return false;
  }
}

/**
 * Mark whether user clicked sign out
 */
export function setExplicitlyLoggedOut(loggedOut: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    if (loggedOut) {
      localStorage.setItem(KEY_EXPLICIT_LOGOUT, 'true');
    } else {
      localStorage.removeItem(KEY_EXPLICIT_LOGOUT);
    }
  } catch {}
}

/**
 * Obfuscate and store login credentials in durable vault for long-term background renewal
 */
export async function saveAuthCredentials(email: string, pass: string): Promise<void> {
  setExplicitlyLoggedOut(false);
  try {
    const payload = JSON.stringify({
      e: email,
      p: btoa(encodeURIComponent(pass)),
      t: Date.now()
    });
    persistentAuthStorage.setItem(KEY_CREDENTIALS, payload);
    await idbSet(KEY_CREDENTIALS, payload);
  } catch (e) {
    console.debug('Failed to save persistent credentials:', e);
  }
}

/**
 * Retrieve saved credentials from persistent vault
 */
export async function getAuthCredentials(): Promise<{ email: string; pass: string } | null> {
  if (isExplicitlyLoggedOut()) return null;
  try {
    let raw = persistentAuthStorage.getItem(KEY_CREDENTIALS);
    if (!raw) {
      raw = await idbGet(KEY_CREDENTIALS);
    }
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (data?.e && data?.p) {
      return {
        email: data.e,
        pass: decodeURIComponent(atob(data.p))
      };
    }
  } catch (e) {
    console.debug('Failed to parse persistent credentials:', e);
  }
  return null;
}

/**
 * Clear all persistent auth data upon intentional user sign out
 */
export async function clearPersistentAuth(): Promise<void> {
  setExplicitlyLoggedOut(true);
  saveCachedUser(null);
  persistentAuthStorage.removeItem(KEY_CREDENTIALS);
  persistentAuthStorage.removeItem(KEY_CACHED_USER);
  await idbDel(KEY_CREDENTIALS);
  await idbDel(KEY_CACHED_USER);
}
