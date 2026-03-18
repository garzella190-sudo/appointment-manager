'use client';

import React, { useState, useEffect } from 'react';
import { MessageCircle, ChevronDown, BellRing, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Modal } from './Modal';
import { generateWhatsAppLink } from '@/utils/whatsapp';
import { format, parseISO } from 'date-fns';
import { it } from 'date-fns/locale';

interface WhatsAppButtonProps {
  phone: string;
  label?: string;
  className?: string;
  variant?: 'primary' | 'secondary' | 'ghost';
  iconSize?: number;
  showLabel?: boolean;
  appointmentData?: {
    date: string;
    time: string;
    duration: number;
  };
}

/**
 * WhatsAppButton - Gestisce la scelta tra WhatsApp Standard e Business.
 * Se presente appointmentData, permette di scegliere tra Promemoria e Chat Libera.
 */
export const WhatsAppButton = ({
  phone,
  label = 'WhatsApp',
  className,
  variant = 'secondary',
  iconSize = 14,
  showLabel = true,
  appointmentData
}: WhatsAppButtonProps) => {
  const [showModal, setShowModal] = useState(false);
  const [showActionModal, setShowActionModal] = useState(false);
  const [preference, setPreference] = useState<'standard' | 'business' | null>(null);
  const [pendingMessage, setPendingMessage] = useState<string | undefined>(undefined);

  // Carica la preferenza al mount
  useEffect(() => {
    const saved = localStorage.getItem('wa_app_preference') as 'standard' | 'business' | null;
    if (saved) setPreference(saved);
  }, []);

  const openWA = (pref: 'standard' | 'business', message?: string) => {
    const isBusiness = pref === 'business';
    const link = generateWhatsAppLink(phone, isBusiness, message);

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

    // Se c'è un appuntamento, chiediamo prima cosa vuole fare (Ricorda vs Chat)
    if (appointmentData) {
      setShowActionModal(true);
    } else {
      // Se non c'è preferenza, usiamo 'standard' come default invece di mostrare il modal
      const effectivePref = preference || 'standard';
      openWA(effectivePref);
    }
  };

  const handleSelect = (pref: 'standard' | 'business') => {
    localStorage.setItem('wa_app_preference', pref);
    setPreference(pref);
    setShowModal(false);
    openWA(pref, pendingMessage);
    setPendingMessage(undefined);
  };

  const handleActionSelect = (mode: 'reminder' | 'chat') => {
    setShowActionModal(false);

    let message: string | undefined = undefined;
    if (mode === 'reminder' && appointmentData) {
      const formattedDate = format(parseISO(appointmentData.date), 'dd/MM/yyyy', { locale: it });
      message = `Ricordati la Guida il giorno ${formattedDate} alle ore ${appointmentData.time} di ${appointmentData.duration} min. Le guide vanno disdette almeno 24h pena addebito dell'intero importo`;
    }

    const effectivePref = preference || 'standard';
    openWA(effectivePref, message);
  };

  return (
    <>
    <div className={cn("inline-flex items-stretch overflow-hidden group border border-transparent hover:border-emerald-200/50 dark:hover:border-emerald-800/50 rounded-xl transition-all", className)}>
      <button
        type="button"
        onClick={handleClick}
        className={cn(
          "flex items-center gap-1.5 transition-all font-semibold h-full",
          variant === 'primary' && "px-4 bg-emerald-600 text-white group-hover:bg-emerald-700",
          variant === 'secondary' && "px-3 py-1.5 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 text-xs group-hover:bg-emerald-100 dark:group-hover:bg-emerald-800/40",
          variant === 'ghost' && "p-2 bg-transparent text-emerald-600 dark:text-emerald-400 group-hover:bg-emerald-50 dark:group-hover:bg-emerald-900/20",
          !className?.includes('p-') && !className?.includes('px-') && "px-3"
        )}
        title={`WhatsApp (${(preference || 'standard') === 'business' ? 'Business' : 'Personale'})`}
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
          "px-2 flex items-center justify-center transition-all border-l",
          variant === 'primary' && "bg-emerald-600 text-white group-hover:bg-emerald-700 border-white/20",
          variant === 'secondary' && "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border-emerald-200/50 dark:border-emerald-800/50 group-hover:bg-emerald-100 dark:group-hover:bg-emerald-800/40",
          variant === 'ghost' && "bg-transparent text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-800/50 group-hover:bg-emerald-50 dark:group-hover:bg-emerald-900/20",
        )}
        title="Cambia app WhatsApp"
      >
        <ChevronDown size={iconSize + 2} />
      </button>
    </div>

      {/* MODAL 1: Azione (Promemoria vs Chat) */}
      {showActionModal && (
        <Modal
          isOpen={showActionModal}
          onClose={() => setShowActionModal(false)}
          title="Cosa vuoi fare?"
        >
          <div className="space-y-6 pt-2">
            <div className="grid grid-cols-1 gap-4">
              <button
                type="button"
                onClick={() => handleActionSelect('reminder')}
                className="flex items-center gap-4 p-5 bg-zinc-50 dark:bg-zinc-900 border-2 border-transparent hover:border-blue-500/50 rounded-[24px] transition-all group text-left"
              >
                <div className="w-12 h-12 rounded-2xl bg-blue-100 dark:bg-blue-900/30 text-blue-600 flex items-center justify-center group-hover:scale-110 transition-transform shrink-0">
                  <BellRing size={24} />
                </div>
                <div>
                  <p className="font-bold text-zinc-900 dark:text-zinc-100">Ricordare guida</p>
                  <p className="text-xs text-zinc-500 mt-0.5">Invia un messaggio precompilato con i dettagli</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleActionSelect('chat')}
                className="flex items-center gap-4 p-5 bg-zinc-50 dark:bg-zinc-900 border-2 border-transparent hover:border-emerald-500/50 rounded-[24px] transition-all group text-left"
              >
                <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 flex items-center justify-center group-hover:scale-110 transition-transform shrink-0">
                  <MessageSquare size={24} />
                </div>
                <div>
                  <p className="font-bold text-zinc-900 dark:text-zinc-100">Aprire chat</p>
                  <p className="text-xs text-zinc-500 mt-0.5">Contatta il cliente con un messaggio libero</p>
                </div>
              </button>
            </div>
            <button
              type="button"
              onClick={() => setShowActionModal(false)}
              className="w-full py-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-sm font-semibold transition-colors"
            >
              Annulla
            </button>
          </div>
        </Modal>
      )}

      {/* MODAL 2: Preferenza App (Standard vs Business) */}
      {showModal && (
        <Modal
          isOpen={showModal}
          onClose={() => {
            setShowModal(false);
            setPendingMessage(undefined);
          }}
          title="Preferenza WhatsApp"
        >
          <div className="space-y-6 pt-2">
            <p className="text-zinc-500 dark:text-zinc-400 text-sm leading-relaxed text-center">
              Quale applicazione preferisci utilizzare? 
              La scelta verrà salvata per i prossimi invii.
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
              onClick={() => {
                setShowModal(false);
                setPendingMessage(undefined);
              }}
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
