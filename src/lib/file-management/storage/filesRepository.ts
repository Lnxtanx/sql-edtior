import { FILES_STORE, LEGACY_LOCAL_FILES_KEY, type BrowserFileRecord, getBrowserDb } from './browser-db';

export type GuestFileRecord = BrowserFileRecord;

export interface CreateGuestFileInput {
  title?: string;
  content?: string;
  parent_id?: string | null;
  is_folder?: boolean;
  file_extension?: string;
  sort_order?: number;
}

export interface UpdateGuestFileInput {
  title?: string;
  content?: string;
  parent_id?: string | null;
  is_folder?: boolean;
  file_extension?: string;
  sort_order?: number;
}

export interface LegacyLocalStorageMigrationResult {
  migrated: boolean;
  importedCount: number;
}

export const MAX_LOCAL_FILES = 10;
export const MAX_CONTENT_SIZE = 500 * 1024;

let migrationPromise: Promise<LegacyLocalStorageMigrationResult> | null = null;

function sortFiles(files: GuestFileRecord[]): GuestFileRecord[] {
  return [...files].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
}

function toTimestamp(value: string): number {
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function normalizeTimestamp(value: unknown, fallback: string): string {
  if (typeof value === 'string' && !Number.isNaN(Date.parse(value))) {
    return value;
  }

  return fallback;
}

function normalizeLegacyFile(input: Partial<GuestFileRecord>): GuestFileRecord {
  const now = new Date().toISOString();
  const isFolder = Boolean(input.is_folder);
  const baseTitle = typeof input.title === 'string' ? input.title.trim() : '';

  return {
    id: typeof input.id === 'string' && input.id.trim() ? input.id : `local_${crypto.randomUUID()}`,
    title: baseTitle || (isFolder ? 'New Folder' : 'Untitled Schema'),
    content: isFolder ? '' : typeof input.content === 'string' ? input.content : '',
    parent_id: typeof input.parent_id === 'string' ? input.parent_id : null,
    is_folder: isFolder,
    file_extension: isFolder
      ? undefined
      : typeof input.file_extension === 'string' && input.file_extension.trim()
        ? input.file_extension
        : 'sql',
    sort_order: typeof input.sort_order === 'number' ? input.sort_order : 0,
    createdAt: normalizeTimestamp(input.createdAt, now),
    updatedAt: normalizeTimestamp(input.updatedAt, now),
  };
}

function parseLegacyLocalStorageFiles(): GuestFileRecord[] {
  if (typeof window === 'undefined') return [];

  const legacyPayload = localStorage.getItem(LEGACY_LOCAL_FILES_KEY);
  if (!legacyPayload) return [];

  try {
    const parsed = JSON.parse(legacyPayload);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.map((file) => normalizeLegacyFile(file as Partial<GuestFileRecord>));
  } catch (error) {
    console.error('Failed to parse legacy local files:', error);
    return [];
  }
}

async function ensureLegacyLocalStorageMigrated(): Promise<void> {
  if (!migrationPromise) {
    migrationPromise = migrateLocalStorageToIndexedDb().catch((error) => {
      migrationPromise = null;
      throw error;
    });
  }

  await migrationPromise;
}

export async function migrateLocalStorageToIndexedDb(): Promise<LegacyLocalStorageMigrationResult> {
  const legacyFiles = parseLegacyLocalStorageFiles();
  if (legacyFiles.length === 0) {
    return { migrated: false, importedCount: 0 };
  }

  const db = await getBrowserDb();
  const tx = db.transaction(FILES_STORE, 'readwrite');
  let importedCount = 0;

  for (const legacyFile of legacyFiles) {
    const existing = await tx.store.get(legacyFile.id);
    if (!existing || toTimestamp(legacyFile.updatedAt) > toTimestamp(existing.updatedAt)) {
      await tx.store.put(legacyFile);
      importedCount += 1;
    }
  }

  await tx.done;
  localStorage.removeItem(LEGACY_LOCAL_FILES_KEY);

  return {
    migrated: true,
    importedCount,
  };
}

export async function getAllFiles(): Promise<GuestFileRecord[]> {
  await ensureLegacyLocalStorageMigrated();

  const db = await getBrowserDb();
  const files = await db.getAll(FILES_STORE);
  return sortFiles(files);
}

export async function getFileById(id: string): Promise<GuestFileRecord | null> {
  await ensureLegacyLocalStorageMigrated();

  const db = await getBrowserDb();
  return (await db.get(FILES_STORE, id)) ?? null;
}

export async function createFile(file: CreateGuestFileInput): Promise<GuestFileRecord> {
  await ensureLegacyLocalStorageMigrated();

  const db = await getBrowserDb();
  const tx = db.transaction(FILES_STORE, 'readwrite');
  const existingFiles = await tx.store.getAll();

  if (!file.is_folder && existingFiles.filter((item) => !item.is_folder).length >= MAX_LOCAL_FILES) {
    throw new Error(`Guest mode is limited to ${MAX_LOCAL_FILES} files. Sign in for unlimited files.`);
  }

  const content = file.content ?? '';
  if (!file.is_folder && content.length > MAX_CONTENT_SIZE) {
    throw new Error(`File content exceeds maximum size of ${MAX_CONTENT_SIZE / 1024}KB`);
  }

  const now = new Date().toISOString();
  const record = normalizeLegacyFile({
    id: `local_${crypto.randomUUID()}`,
    title: file.title,
    content,
    parent_id: file.parent_id ?? null,
    is_folder: file.is_folder ?? false,
    file_extension: file.file_extension,
    sort_order: file.sort_order ?? 0,
    createdAt: now,
    updatedAt: now,
  });

  await tx.store.add(record);
  await tx.done;

  return record;
}

export async function updateFile(id: string, updates: UpdateGuestFileInput): Promise<GuestFileRecord | null> {
  await ensureLegacyLocalStorageMigrated();

  const db = await getBrowserDb();
  const tx = db.transaction(FILES_STORE, 'readwrite');
  const existing = await tx.store.get(id);

  if (!existing) {
    await tx.done;
    return null;
  }

  const nextContent = updates.content ?? existing.content;
  const nextIsFolder = updates.is_folder ?? existing.is_folder;

  if (!nextIsFolder && nextContent.length > MAX_CONTENT_SIZE) {
    throw new Error(`File content exceeds maximum size of ${MAX_CONTENT_SIZE / 1024}KB`);
  }

  const updatedRecord = normalizeLegacyFile({
    ...existing,
    ...updates,
    id: existing.id,
    content: nextIsFolder ? '' : nextContent,
    is_folder: nextIsFolder,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  });

  await tx.store.put(updatedRecord);
  await tx.done;

  return updatedRecord;
}

export async function deleteFile(id: string): Promise<boolean> {
  await ensureLegacyLocalStorageMigrated();

  const db = await getBrowserDb();
  const tx = db.transaction(FILES_STORE, 'readwrite');
  const existing = await tx.store.get(id);

  if (!existing) {
    await tx.done;
    return false;
  }

  const allFiles = await tx.store.getAll();
  const idsToDelete = new Set<string>([id]);

  if (existing.is_folder) {
    const queue = [id];

    while (queue.length > 0) {
      const parentId = queue.shift()!;
      for (const file of allFiles) {
        if (file.parent_id === parentId && !idsToDelete.has(file.id)) {
          idsToDelete.add(file.id);
          queue.push(file.id);
        }
      }
    }
  }

  await Promise.all([...idsToDelete].map((fileId) => tx.store.delete(fileId)));
  await tx.done;

  return true;
}

export async function clearAllFiles(): Promise<void> {
  await ensureLegacyLocalStorageMigrated();

  const db = await getBrowserDb();
  const tx = db.transaction(FILES_STORE, 'readwrite');
  await tx.store.clear();
  await tx.done;

  if (typeof window !== 'undefined') {
    localStorage.removeItem(LEGACY_LOCAL_FILES_KEY);
  }
}

export async function hasFiles(): Promise<boolean> {
  const count = await getFileCount();
  return count > 0;
}

export async function getFileCount(): Promise<number> {
  await ensureLegacyLocalStorageMigrated();

  const db = await getBrowserDb();
  return db.count(FILES_STORE);
}

export async function canCreateFile(): Promise<boolean> {
  const files = await getAllFiles();
  return files.filter((file) => !file.is_folder).length < MAX_LOCAL_FILES;
}

export async function getRemainingSlots(): Promise<number> {
  const files = await getAllFiles();
  return MAX_LOCAL_FILES - files.filter((file) => !file.is_folder).length;
}

export async function getFilesForMigration(): Promise<Array<{ title: string; content: string; file_extension?: string }>> {
  const files = await getAllFiles();

  return files
    .filter((file) => !file.is_folder)
    .map((file) => ({
      title: file.title,
      content: file.content,
      file_extension: file.file_extension,
    }));
}

export async function completeMigration(): Promise<void> {
  await clearAllFiles();
}
