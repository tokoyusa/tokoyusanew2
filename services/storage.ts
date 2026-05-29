// Safe fallback storage utility for sandbox preview frames or environments where cookies/localStorage are blocked
const getSafeStorage = () => {
  try {
    const storage = window.localStorage;
    // Perform a test write/delete to verify accessibility
    const testKey = '__storage_test__';
    storage.setItem(testKey, testKey);
    storage.removeItem(testKey);
    return storage;
  } catch (e) {
    console.warn("Storage is blocked or inaccessible in this environment. Falling back to safe in-memory storage.", e);
  }

  // In-memory surrogate storage
  const memoryStore: Record<string, string> = {};
  return {
    getItem: (key: string): string | null => {
      return key in memoryStore ? memoryStore[key] : null;
    },
    setItem: (key: string, value: string): void => {
      memoryStore[key] = String(value);
    },
    removeItem: (key: string): void => {
      delete memoryStore[key];
    },
    clear: (): void => {
      for (const k in memoryStore) {
        delete memoryStore[k];
      }
    },
    key: (index: number): string | null => {
      return Object.keys(memoryStore)[index] || null;
    },
    get length(): number {
      return Object.keys(memoryStore).length;
    }
  } as Storage;
};

export const safeStorage = getSafeStorage();
