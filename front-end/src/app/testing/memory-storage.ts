/**
 * localStorage/sessionStorage simple, in memorie, pentru teste.
 * Node 26 defineste un `localStorage` global gol (fara --localstorage-file) care il ascunde
 * pe cel din jsdom; le inlocuim pe amandoua inainte de fiecare test.
 */
export function installMemoryStorage(): { local: Storage; session: Storage } {
  const local = createStorage();
  const session = createStorage();
  Object.defineProperty(globalThis, 'localStorage', { value: local, configurable: true, writable: true });
  Object.defineProperty(globalThis, 'sessionStorage', { value: session, configurable: true, writable: true });
  return { local, session };
}

function createStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (key) => data.get(key) ?? null,
    key: (index) => Array.from(data.keys())[index] ?? null,
    removeItem: (key) => void data.delete(key),
    setItem: (key, value) => void data.set(key, String(value)),
  };
}
