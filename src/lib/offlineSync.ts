import { openDB, DBSchema, IDBPDatabase } from 'idb';

interface SyncDB extends DBSchema {
  sync_queue: {
    key: string;
    value: {
      id: string;
      entity_type: string;
      action: string;
      payload: any;
      created_at: string;
      status: 'pending' | 'syncing' | 'failed';
      error_message?: string;
    };
  };
}

let dbPromise: Promise<IDBPDatabase<SyncDB>> | null = null;

if (typeof window !== 'undefined') {
  dbPromise = openDB<SyncDB>('appointment-manager-sync', 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('sync_queue')) {
        db.createObjectStore('sync_queue', { keyPath: 'id' });
      }
    },
  });
}

export async function addToOfflineQueue(entity_type: string, action: string, payload: any): Promise<string> {
  if (!dbPromise) throw new Error('IndexedDB not initialized');
  const db = await dbPromise;
  
  const id = crypto.randomUUID();
  await db.add('sync_queue', {
    id,
    entity_type,
    action,
    payload,
    created_at: new Date().toISOString(),
    status: 'pending'
  });
  
  return id;
}

export async function getOfflineQueue() {
  if (!dbPromise) return [];
  const db = await dbPromise;
  return await db.getAll('sync_queue');
}

export async function removeFromOfflineQueue(id: string) {
  if (!dbPromise) return;
  const db = await dbPromise;
  await db.delete('sync_queue', id);
}

export async function clearOfflineQueue() {
  if (!dbPromise) return;
  const db = await dbPromise;
  await db.clear('sync_queue');
}

export async function updateOfflineQueueStatus(id: string, status: 'pending' | 'syncing' | 'failed', error_message?: string) {
  if (!dbPromise) return;
  const db = await dbPromise;
  const item = await db.get('sync_queue', id);
  if (item) {
    item.status = status;
    item.error_message = error_message;
    await db.put('sync_queue', item);
  }
}
