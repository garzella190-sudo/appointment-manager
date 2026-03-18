'use client';

import React, { useState, useEffect } from 'react';
import { MessageCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Modal } from './Modal';

interface WhatsAppButtonProps {
  phone: string;
  label?: string;
  className?: string;
  variant?: 'primary' | 'secondary' | 'ghost';
  iconSize?: number;
  showLabel?: boolean;
}

/**
 * WhatsAppButton - Gestisce la scelta tra WhatsApp Standard e Business.
 * Memorizza la preferenza nel localStorage per utilizzi futuri.
 */
export const WhatsAppButton = ({ 
  phone, 
  label = 'WhatsApp', 
  className, 
  variant = 'secondary',
  iconSize = 14,
  showLabel = true
}: WhatsAppButtonProps) => {
  const [showModal, setShowModal] = useState(false);
  const [preference, setPreference] = useState<'standard' | 'business' | null>(null);

  // Carica la preferenza al mount
  useEffect(() => {
    const saved = localStorage.getItem('wa_app_preference') as 'standard' | 'business' | null;
    if (saved) setPreference(saved);
  }, []);

  const openWA = (pref: 'standard' | 'business') => {
    const cleanPhone = phone.replace(/\D/g, '');
    const isAndroid = /android/i.test(navigator.userAgent);
    
    // Assicuriamoci che il numero abbia il prefisso 39 se mancante (Italia default)
    const fullPhone = cleanPhone.startsWith('39') ? cleanPhone : `39${cleanPhone}`;

    if (isAndroid) {
      if (pref === 'business') {
        window.location.href = `intent://send?phone=${fullPhone}#Intent;package=com.whatsapp.w4b;scheme=whatsapp;end;`;
      } else {
        window.location.href = `intent://send?phone=${fullPhone}#Intent;package=com.whatsapp;scheme=whatsapp;end;`;
      }
    } else {
      // Fallback Universale (iOS / Web / Mac / Windows)
      window.open(`https://wa.me/${fullPhone}`, '_blank');
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (preference) {
      openWA(preference);
    } else {
      setShowModal(true);
    }
  };

  const handleSelect = (pref: 'standard' | 'business') => {
    localStorage.setItem('wa_app_preference', pref);
    setPreference(pref);
    setShowModal(false);
    openWA(pref);
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className={cn(
          "flex items-center gap-1.5 transition-all font-semibold",
          variant === 'primary' && "p-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 shadow-md shadow-emerald-500/20",
          variant === 'secondary' && "px-3 py-1 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-lg text-xs hover:bg-emerald-100 dark:hover:bg-emerald-800/40",
          variant === 'ghost' && "p-2 bg-transparent text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-xl",
          className
        )}
        title="Contatta su WhatsApp"
      >
        <MessageCircle size={iconSize} />
        {showLabel && label && <span>{label}</span>}
      </button>

      {showModal && (
        <Modal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          title="WhatsApp Preference"
        >
          <div className="space-y-6 pt-2">
            <p className="text-zinc-500 dark:text-zinc-400 text-sm leading-relaxed text-center">
              Quale applicazione preferisci utilizzare per contattare i tuoi clienti? 
              La tua scelta verrà memorizzata.
            </p>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => handleSelect('standard')}
                className="flex flex-col items-center gap-4 p-6 bg-zinc-50 dark:bg-zinc-900 border-2 border-transparent hover:border-emerald-500/50 rounded-[24px] transition-all group"
              >
                <div className="w-14 h-14 rounded-2xl bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <MessageCircle size={28} />
                </div>
                <div className="text-center">
                  <p className="font-bold text-zinc-900 dark:text-zinc-100">WhatsApp</p>
                  <p className="text-[10px] text-zinc-400 uppercase font-black tracking-widest mt-1">Personale</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleSelect('business')}
                className="flex flex-col items-center gap-4 p-6 bg-zinc-50 dark:bg-zinc-900 border-2 border-transparent hover:border-blue-500/50 rounded-[24px] transition-all group"
              >
                <div className="w-14 h-14 rounded-2xl bg-blue-100 dark:bg-blue-900/30 text-blue-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <MessageCircle size={28} />
                </div>
                <div className="text-center">
                  <p className="font-bold text-zinc-900 dark:text-zinc-100">WhatsApp</p>
                  <p className="text-[10px] text-blue-400 uppercase font-black tracking-widest mt-1">Business</p>
                </div>
              </button>
            </div>

            <button
              type="button"
              onClick={() => setShowModal(false)}
              className="w-full py-3 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-sm font-semibold transition-colors"
            >
              Forse più tardi
            </button>
          </div>
        </Modal>
      )}
    </>
  );
};
