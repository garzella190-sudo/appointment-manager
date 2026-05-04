'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { InstallPWA } from './InstallPWA';
import { Modal } from './Modal';

export const InstallPrompt = () => {
  const { user, loading } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    // Solo se l'utente è loggato e non stiamo caricando
    if (!loading && user) {
      const dismissed = localStorage.getItem('pwa_prompt_dismissed');
      const isPWA = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;

      if (!dismissed && !isPWA) {
        // Mostra dopo un breve ritardo per non sovrapporsi al caricamento iniziale
        const timer = setTimeout(() => {
          setIsOpen(true);
        }, 2000);
        return () => clearTimeout(timer);
      }
    }
  }, [user, loading]);

  const handleDismiss = () => {
    setIsOpen(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="w-full max-w-lg animate-in zoom-in-95 slide-in-from-bottom-10 duration-500">
        <InstallPWA onDismiss={handleDismiss} />
      </div>
    </div>
  );
};
