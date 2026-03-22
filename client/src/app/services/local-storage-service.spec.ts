import { LocalStorageService } from './local-storage-service';

const createLocalStorageMock = () => {
  const store = new Map<string, string>();
  return {
    getItem: vi.fn((key: string) => store.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => { store.set(key, value); }),
    removeItem: vi.fn((key: string) => { store.delete(key); }),
    clear: vi.fn(() => { store.clear(); }),
    _store: store,
  };
};

const TEST_KEY = 'test_key';

describe('LocalStorageService', () => {
  let service: LocalStorageService;
  let mockStorage: ReturnType<typeof createLocalStorageMock>;

  beforeEach(() => {
    mockStorage = createLocalStorageMock();
    vi.stubGlobal('localStorage', mockStorage);
    service = new LocalStorageService();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  describe('loadElements', () => {
    it('should return an empty array when key does not exist', () => {
      expect(service.loadElements(TEST_KEY)).toEqual([]);
    });

    it('should return stored array of elements', () => {
      const items = [{ id: 1, name: 'Item A' }, { id: 2, name: 'Item B' }];
      mockStorage._store.set(TEST_KEY, JSON.stringify(items));

      expect(service.loadElements(TEST_KEY)).toEqual(items);
    });
  });

  describe('createElement', () => {
    it('should assign a random id in range [100000, 99999999]', () => {
      const element = { id: 0, name: 'New Item' };
      const created = service.createElement(TEST_KEY, element);

      expect(created.id).toBeGreaterThanOrEqual(100_000);
      expect(created.id).toBeLessThanOrEqual(99_999_999);
    });

    it('should prepend the new element to the existing list', () => {
      const existing = { id: 1, name: 'Existing' };
      mockStorage._store.set(TEST_KEY, JSON.stringify([existing]));

      const created = service.createElement(TEST_KEY, { id: 0, name: 'New' });
      const stored = service.loadElements<any>(TEST_KEY);

      expect(stored[0].id).toBe(created.id);
      expect(stored[1]).toEqual(existing);
    });

    it('should persist the created element to localStorage', () => {
      service.createElement(TEST_KEY, { id: 0, val: 42 });

      expect(mockStorage.setItem).toHaveBeenCalledWith(TEST_KEY, expect.any(String));
    });
  });

  describe('updateElement', () => {
    it('should update the element matching by id', () => {
      const items = [{ id: 1, name: 'Old' }, { id: 2, name: 'Other' }];
      mockStorage._store.set(TEST_KEY, JSON.stringify(items));

      service.updateElement(TEST_KEY, { id: 1, name: 'Updated' });

      const stored = service.loadElements<any>(TEST_KEY);
      expect(stored.find((e: any) => e.id === 1)?.name).toBe('Updated');
    });

    it('should leave other elements unchanged', () => {
      const items = [{ id: 1, name: 'A' }, { id: 2, name: 'B' }];
      mockStorage._store.set(TEST_KEY, JSON.stringify(items));

      service.updateElement(TEST_KEY, { id: 1, name: 'Updated A' });

      const stored = service.loadElements<any>(TEST_KEY);
      expect(stored.find((e: any) => e.id === 2)?.name).toBe('B');
    });
  });

  describe('deleteElement', () => {
    it('should remove element with matching id', () => {
      const items = [{ id: 1 }, { id: 2 }];
      mockStorage._store.set(TEST_KEY, JSON.stringify(items));

      service.deleteElement(TEST_KEY, 1);

      const stored = service.loadElements<any>(TEST_KEY);
      expect(stored).toHaveLength(1);
      expect(stored[0].id).toBe(2);
    });

    it('should keep all elements when id is not found', () => {
      const items = [{ id: 1 }, { id: 2 }];
      mockStorage._store.set(TEST_KEY, JSON.stringify(items));

      service.deleteElement(TEST_KEY, 99);

      expect(service.loadElements<any>(TEST_KEY)).toHaveLength(2);
    });
  });

  describe('loadObject', () => {
    it('should return undefined when key does not exist', () => {
      expect(service.loadObject('missing_key')).toBeUndefined();
    });

    it('should return the parsed JSON object', () => {
      mockStorage._store.set(TEST_KEY, JSON.stringify({ foo: 'bar', count: 42 }));

      expect(service.loadObject(TEST_KEY)).toEqual({ foo: 'bar', count: 42 });
    });

    it('should return undefined for invalid JSON', () => {
      mockStorage._store.set(TEST_KEY, 'not-valid-json{');

      expect(service.loadObject(TEST_KEY)).toBeUndefined();
    });
  });

  describe('saveObject', () => {
    it('should serialize object to JSON and store in localStorage', () => {
      const obj = { a: 1, b: 'hello' };
      service.saveObject(TEST_KEY, obj);

      expect(mockStorage.setItem).toHaveBeenCalledWith(TEST_KEY, JSON.stringify(obj));
    });

    it('should overwrite existing value for the same key', () => {
      service.saveObject(TEST_KEY, { v: 1 });
      service.saveObject(TEST_KEY, { v: 2 });

      const stored = service.loadObject(TEST_KEY);
      expect(stored).toEqual({ v: 2 });
    });
  });
});
