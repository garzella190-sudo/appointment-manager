'use client';

import { useEffect, useState } from 'react';
import { getOfflineQueue, removeFromOfflineQueue, updateOfflineQueueStatus } from '@/lib/offlineSync';
import { processOfflineSyncAction } from '@/actions/sync';
import { useToast } from '@/hooks/useToast';
import { Wifi, WifiOff, RefreshCcw } from 'lucide-react';

export function SyncManager() {
  const { showToast } = useToast();
  const [isOnline, setIsOnline] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    setIsOnline(navigator.onLine);

    const handleOnline = () => {
      setIsOnline(true);
      showToast('Connessione ripristinata. Sincronizzazione in corso...', 'info', 4000);
      syncOfflineData();
    };

    const handleOffline = () => {
      setIsOnline(false);
      showToast('Sei offline. Le modifiche verranno salvate sul dispositivo.', 'error', 4000);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial check for pending items
    checkQueue();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const checkQueue = async () => {
    try {
      const queue = await getOfflineQueue();
      setPendingCount(queue.filter(q => q.status === 'pending' || q.status === 'failed').length);
    } catch (e) {
      console.error('Check queue error:', e);
    }
  };

  const syncOfflineData = async () => {
    if (!navigator.onLine || isSyncing) return;
    
    try {
      setIsSyncing(true);
      const queue = await getOfflineQueue();
      const itemsToSync = queue.filter(q => q.status === 'pending' || q.status === 'failed');
      
      if (itemsToSync.length === 0) {
        setIsSyncing(false);
        return;
      }

      for (const item of itemsToSync) {
        await updateOfflineQueueStatus(item.id, 'syncing');
      }

      // Invia al server
      const res = await processOfflineSyncAction(itemsToSync);

      if (res.success) {
        let conflictsCount = 0;
        
        for (const result of res.results) {
          if (result.status === 'success') {
            await removeFromOfflineQueue(result.id);
          } else if (result.status === 'conflict') {
            await removeFromOfflineQueue(result.id);
            conflictsCount++;
          } else {
            await updateOfflineQueueStatus(result.id, 'failed', result.error);
          }
        }

        if (conflictsCount > 0) {
          showToast(`Attenzione: ci sono ${conflictsCount} elementi in conflitto. Risolvili dalla pagina Gestione -> Conflitti.`, 'error', 10000);
        } else {
          showToast('Sincronizzazione completata!', 'success');
        }
      }
      
    } catch (err) {
      console.error('Sync failed', err);
    } finally {
      setIsSyncing(false);
      checkQueue();
      
      // Notify other components to refresh their data
      window.dispatchEvent(new CustomEvent('appointments-updated'));
    }
  };

  // We expose a global function so other components can trigger sync manually if needed
  useEffect(() => {
    (window as any).forceSyncOfflineQueue = syncOfflineData;
    (window as any).checkOfflineQueue = checkQueue;
  }, []);

  if (isOnline && pendingCount === 0) return null;

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold shadow-lg animate-in fade-in slide-in-from-top-4 backdrop-blur-md bg-white/90 border border-zinc-200 dark:bg-zinc-800/90 dark:border-zinc-700">
      {!isOnline ? (
        <span className="flex items-center gap-2 text-amber-600 dark:text-amber-500">
          <WifiOff size={14} /> Modalità Offline
          {pendingCount > 0 && <span className="bg-amber-100 text-amber-800 px-1.5 rounded-md">{pendingCount} in attesa</span>}
        </span>
      ) : isSyncing ? (
        <span className="flex items-center gap-2 text-sky-600 dark:text-sky-400">
          <RefreshCcw size={14} className="animate-spin" /> Sincronizzazione...
        </span>
      ) : pendingCount > 0 ? (
        <span className="flex items-center gap-2 text-sky-600 dark:text-sky-400 cursor-pointer" onClick={syncOfflineData}>
          <Wifi size={14} /> {pendingCount} modifiche da caricare (Clicca per sincronizzare)
        </span>
      ) : null}
    </div>
  );
}
