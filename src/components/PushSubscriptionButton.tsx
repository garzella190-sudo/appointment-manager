'use client';

import React, { useState, useEffect } from 'react';
import { Bell, BellRing, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/useToast';

export function PushSubscriptionButton() {
  const { showToast } = useToast();
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      setIsSupported(true);
      checkSubscription();
    }
  }, []);

  const checkSubscription = async () => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      setIsSubscribed(!!subscription);
    } catch (e) {
      console.error('Errore nel controllo della subscription push:', e);
    }
  };

  const urlBase64ToUint8Array = (base64String: string) => {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/\-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  };

  const handleSubscribe = async () => {
    setIsLoading(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        showToast('Devi consentire le notifiche nel browser.', 'error');
        setIsLoading(false);
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      
      if (!vapidPublicKey) {
        showToast('Configurazione notifiche mancante sul server.', 'error');
        return;
      }

      const convertedVapidKey = urlBase64ToUint8Array(vapidPublicKey);

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedVapidKey
      });

      const response = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription })
      });

      if (response.ok) {
        setIsSubscribed(true);
        showToast('Notifiche Push attivate!', 'success');
      } else {
        showToast('Errore durante l\'attivazione sul server.', 'error');
      }
    } catch (err: any) {
      console.error('Push error:', err);
      showToast('Errore imprevisto. Verifica le impostazioni del telefono.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUnsubscribe = async () => {
    setIsLoading(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      
      if (subscription) {
        // Rimuovi dal server
        await fetch('/api/push/subscribe', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: subscription.endpoint })
        });
        
        // Rimuovi dal browser
        await subscription.unsubscribe();
        setIsSubscribed(false);
        showToast('Notifiche Push disattivate.', 'success');
      }
    } catch (err) {
      console.error('Error unsubscribing:', err);
      showToast('Errore durante la disattivazione.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isSupported) {
    return (
      <div className="text-[10px] text-zinc-400 p-3 bg-zinc-50 rounded-xl text-center">
        Notifiche Push non supportate dal tuo browser o dispositivo.
      </div>
    );
  }

  return (
    <button
      onClick={isSubscribed ? handleUnsubscribe : handleSubscribe}
      disabled={isLoading}
      className={cn(
        "flex items-center justify-between w-full p-4 rounded-2xl transition-all border active:scale-95 disabled:opacity-50",
        isSubscribed 
          ? "bg-sky-50 dark:bg-sky-900/20 border-sky-200 dark:border-sky-800" 
          : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800"
      )}
    >
      <div className="flex items-center gap-3">
        <div className={cn(
          "w-10 h-10 rounded-xl flex items-center justify-center",
          isSubscribed ? "bg-sky-100 dark:bg-sky-900 text-sky-600 dark:text-sky-400" : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500"
        )}>
          {isLoading ? <Loader2 size={18} className="animate-spin" /> : (isSubscribed ? <BellRing size={18} /> : <Bell size={18} />)}
        </div>
        <div className="text-left">
          <p className="text-sm font-bold text-zinc-900 dark:text-white">
            Notifiche Push
          </p>
          <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
            {isSubscribed ? "Ricevi avvisi per nuove guide" : "Clicca per attivare gli avvisi"}
          </p>
        </div>
      </div>
      
      <div className={cn(
        "w-12 h-6 rounded-full p-1 transition-colors duration-300 relative",
        isSubscribed ? "bg-sky-500" : "bg-zinc-300 dark:bg-zinc-700"
      )}>
        <div className={cn(
          "w-4 h-4 bg-white rounded-full transition-transform duration-300 absolute",
          isSubscribed ? "translate-x-6" : "translate-x-0"
        )} />
      </div>
    </button>
  );
}
