'use client';

import { useEffect, useState } from 'react';
import { RefreshCw, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function SWRegister() {
  const [showUpdatePrompt, setShowUpdatePrompt] = useState(false);
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          // Check for update on registration
          if (registration.waiting) {
            setWaitingWorker(registration.waiting);
            setShowUpdatePrompt(true);
          }

          // Listen for new updates
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  setWaitingWorker(newWorker);
                  setShowUpdatePrompt(true);
                }
              });
            }
          });
        })
        .catch((error) => {
          console.log('SW registration failed:', error);
        });

      // Reload page when the new service worker takes over
      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!refreshing) {
          refreshing = true;
          window.location.reload();
        }
      });
    }
  }, []);

  const handleUpdate = () => {
    if (waitingWorker) {
      waitingWorker.postMessage({ type: 'SKIP_WAITING' });
      setShowUpdatePrompt(false);
    }
  };

  if (!showUpdatePrompt) return null;

  return (
    <div className="fixed bottom-28 left-1/2 -translate-x-1/2 z-[100] w-[90%] max-w-md animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-zinc-900/90 dark:bg-zinc-100/90 backdrop-blur-xl border border-white/10 dark:border-black/5 p-4 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.3)] flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-blue-500 flex items-center justify-center shrink-0">
            <RefreshCw className="text-white animate-spin-slow" size={20} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-white dark:text-zinc-900 leading-tight">Nuova versione!</p>
            <p className="text-[11px] text-zinc-400 dark:text-zinc-500 truncate">Aggiorna per le ultime novità</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            onClick={handleUpdate}
            className="h-10 bg-blue-600 hover:bg-blue-500 text-white px-5 rounded-xl text-xs font-black uppercase tracking-wider transition-all active:scale-95 shadow-lg shadow-blue-500/25 flex items-center justify-center"
          >
            Aggiorna
          </button>
          <button
            onClick={() => setShowUpdatePrompt(false)}
            className="p-2 text-zinc-500 hover:text-white dark:hover:text-zinc-900 transition-colors"
          >
            <X size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
