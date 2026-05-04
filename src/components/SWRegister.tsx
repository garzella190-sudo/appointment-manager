'use client';

import { useEffect, useState } from 'react';
import { RefreshCw, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function SWRegister() {
  const [showUpdatePrompt, setShowUpdatePrompt] = useState(false);
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    let updateInterval: NodeJS.Timeout;
    let registration: ServiceWorkerRegistration;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && registration) {
        registration.update();
      }
    };

    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      // Force physical file rename to bypass iOS cache
      navigator.serviceWorker
        .register('/sw-v10.js')
        .then((reg) => {
          registration = reg;
          
          // 1. Check for update immediately on registration (initial opening)
          registration.update();

          if (registration.waiting) {
            registration.waiting.postMessage({ type: 'SKIP_WAITING' });
          }

          // 2. Poll for updates every 30 minutes
          updateInterval = setInterval(() => {
            registration.update();
          }, 30 * 60 * 1000);

          // 3. Check for update when the app comes to foreground
          document.addEventListener('visibilitychange', handleVisibilityChange);

          // Listen for new updates
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  // Auto update without prompt
                  newWorker.postMessage({ type: 'SKIP_WAITING' });
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
      const handleControllerChange = () => {
        if (!refreshing) {
          refreshing = true;
          window.location.reload();
        }
      };
      navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);

      return () => {
        if (updateInterval) clearInterval(updateInterval);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
      };
    }
  }, []);

  return null;
}
