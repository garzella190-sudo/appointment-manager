'use client';

import React, { useState, useEffect } from 'react';
import { MessageCircle, BellRing, MessageSquare } from 'lucide-react';
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
 * WhatsAppButton - Apre WhatsApp (chat libera) oppure invia il promemoria della guida.
 *
 * Se c'è `appointmentData` il tasto chiede prima cosa fare ("Ricordare guida" o
 * "Aprire chat").
 *
 * L'app da usare è decisa da `localStorage.wa_app_preference` ('standard' | 'business',
 * default personale). La linguetta per cambiarla è stata RIMOSSA su richiesta: non c'è
 * più il tasto col chevron né il modale di scelta. Chi aveva salvato "Business" continua
 * ad aprire Business; per tornare al personale basta togliere quella chiave dal browser.
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
  const [showActionModal, setShowActionModal] = useState(false);
  const [preference, setPreference] = useState<'standard' | 'business' | null>(null);

  // Preferenza già salvata sul dispositivo (nessuna interfaccia per cambiarla).
  // `localStorage` esiste solo lato client: la lettura va in un effetto, non nel
  // render (altrimenti il server non saprebbe quale app è impostata).
  useEffect(() => {
    const saved = localStorage.getItem('wa_app_preference') as 'standard' | 'business' | null;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (saved) setPreference(saved);
  }, []);

  const openWA = (message?: string) => {
    const isBusiness = (preference || 'standard') === 'business';
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

    // Se c'è un appuntamento, chiediamo prima cosa vuole fare (Ricordare vs Chat)
    if (appointmentData) {
      setShowActionModal(true);
    } else {
      openWA();
    }
  };

  const handleActionSelect = (mode: 'reminder' | 'chat') => {
    setShowActionModal(false);

    let message: string | undefined = undefined;
    if (mode === 'reminder' && appointmentData) {
      const formattedDate = format(parseISO(appointmentData.date), 'dd/MM/yyyy', { locale: it });
      message = `Ricordati la Guida il giorno ${formattedDate} alle ore ${appointmentData.time} di ${appointmentData.duration} min.`;
    }

    openWA(message);
  };

  return (
    <>
    <div className={cn("inline-flex items-stretch min-h-[34px] overflow-hidden group border border-transparent hover:border-emerald-200/50 dark:hover:border-emerald-800/50 rounded-xl transition-all", className)}>
      <button
        type="button"
        onClick={handleClick}
        className={cn(
          "flex items-center gap-1.5 transition-all font-semibold h-full",
          variant === 'primary' && "px-4 bg-emerald-600 text-white group-hover:bg-emerald-700",
          variant === 'secondary' && "px-3 py-2 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 text-xs group-hover:bg-emerald-100 dark:group-hover:bg-emerald-800/40",
          variant === 'ghost' && "p-2.5 bg-transparent text-emerald-600 dark:text-emerald-400 group-hover:bg-emerald-50 dark:group-hover:bg-emerald-900/20",
          !className?.includes('p-') && !className?.includes('px-') && "px-3"
        )}
        title={`WhatsApp (${(preference || 'standard') === 'business' ? 'Business' : 'Personale'})`}
      >
        <MessageCircle size={iconSize} />
        {showLabel && label && <span>{label}</span>}
      </button>
    </div>

      {/* MODAL: Azione (Promemoria vs Chat) */}
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
    </>
  );
};

export default WhatsAppButton;
