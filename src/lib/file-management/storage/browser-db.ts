import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

export const BROWSER_DB_NAME = 'schemaweaver-db';
export const BROWSER_DB_VERSION = 1;
export const FILES_STORE = 'files';
export const LEGACY_LOCAL_FILES_KEY = 'sw_local_files';

export interface BrowserFileRecord {
  id: string;
  title: string;
  content: string;
  parent_id: string | null;
  is_folder: boolean;
  file_extension?: string;
  sort_order: number;
  createdAt: string;
  updatedAt: string;
}

interface SchemaWeaverDbSchema extends DBSchema {
  [FILES_STORE]: {
    key: string;
    value: BrowserFileRecord;
    indexes: {
      'by-parent-id': string | null;
      'by-updated-at': string;
    };
  };
}

let dbPromise: Promise<IDBPDatabase<SchemaWeaverDbSchema>> | null = null;

export function getBrowserDb(): Promise<IDBPDatabase<SchemaWeaverDbSchema>> {
  if (typeof window === 'undefined' || typeof indexedDB === 'undefined') {
    throw new Error('IndexedDB is not available in this environment.');
  }

  dbPromise ??= openDB<SchemaWeaverDbSchema>(BROWSER_DB_NAME, BROWSER_DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(FILES_STORE)) {
        const filesStore = db.createObjectStore(FILES_STORE, { keyPath: 'id' });
        filesStore.createIndex('by-parent-id', 'parent_id');
        filesStore.createIndex('by-updated-at', 'updatedAt');
      }
    },
  });

  return dbPromise;
}
