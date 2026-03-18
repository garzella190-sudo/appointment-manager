'use client';

import React, { useState, useEffect } from 'react';
import { MessageCircle, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Modal } from './Modal';
import { generateWhatsAppLink } from '@/utils/whatsapp';

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
    const isBusiness = pref === 'business';
    const link = generateWhatsAppLink(phone, isBusiness);
    
    // Su desktop usiamo window.open, sugli intent Android/iOS a volte serve window.location.href
    if (link.startsWith('intent://') || link.startsWith('whatsapp://')) {
      window.location.href = link;
    } else {
      window.open(link, '_blank');
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
    <div className={cn("inline-flex items-stretch overflow-hidden", className)}>
      <button
        type="button"
        onClick={handleClick}
        className={cn(
          "flex items-center gap-1.5 transition-all font-semibold rounded-none h-full",
          variant === 'primary' && "p-2 bg-emerald-600 text-white hover:bg-emerald-700",
          variant === 'secondary' && "px-3 py-1 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 text-xs hover:bg-emerald-100 dark:hover:bg-emerald-800/40",
          variant === 'ghost' && "p-2 bg-transparent text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20",
          // Se la classe passata non ha padding, aggiungiamolo noi
          !className?.includes('p-') && !className?.includes('px-') && "px-3"
        )}
        title={`WhatsApp (${preference === 'business' ? 'Business' : 'Personale'})`}
      >
        <MessageCircle size={iconSize} />
        {showLabel && label && <span>{label}</span>}
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setShowModal(true);
        }}
        className={cn(
          "px-1.5 flex items-center justify-center transition-all border-l",
          variant === 'primary' && "bg-emerald-600 text-white hover:bg-emerald-700 border-white/20",
          variant === 'secondary' && "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border-emerald-200/50 dark:border-emerald-800/50 hover:bg-emerald-100 dark:hover:bg-emerald-800/40",
          variant === 'ghost' && "bg-transparent text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-800/50 hover:bg-emerald-50 dark:hover:bg-emerald-900/20",
        )}
        title="Cambia app WhatsApp"
      >
        <ChevronDown size={iconSize + 2} />
      </button>
    </div>

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
