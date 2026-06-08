import { MMKV } from 'react-native-mmkv';

const storageInstance = new MMKV();

export const storage = {
  setItem: (key: string, value: string | number | boolean | object | null | undefined) => {
    if (value === null || value === undefined) {
      storageInstance.delete(key);
      return;
    }
    if (typeof value === 'object') {
      storageInstance.set(key, JSON.stringify(value));
    } else {
      storageInstance.set(key, value);
    }
  },

  getString: (key: string): string | undefined => {
    return storageInstance.getString(key);
  },

  getObject: <T>(key: string): T | null => {
    const value = storageInstance.getString(key);
    if (!value) return null;
    try {
      return JSON.parse(value) as T;
    } catch (e) {
      console.error(`Error parsing storage key ${key}:`, e);
      return null;
    }
  },

  getNumber: (key: string): number | undefined => {
    return storageInstance.getNumber(key);
  },

  getBoolean: (key: string): boolean | undefined => {
    return storageInstance.getBoolean(key);
  },

  removeItem: (key: string) => {
    storageInstance.delete(key);
  },

  clearAll: () => {
    storageInstance.clearAll();
  },
};
