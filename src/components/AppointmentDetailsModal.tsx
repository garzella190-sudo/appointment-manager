'use client';

import React from 'react';
import { Appointment } from '@/types';
import Link from 'next/link';
import { User, Phone, Calendar as CalendarIcon, Car, FileText, X, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AppointmentDetailsModalProps {
  appointment: Appointment;
  onClose: () => void;
  onEdit?: (app: Appointment) => void;
  onDelete?: (id: string) => void;
  onCancelGuide?: (id: string) => void;
}

export const AppointmentDetailsModal: React.FC<AppointmentDetailsModalProps> = ({
  appointment,
  onClose,
  onEdit,
  onDelete,
  onCancelGuide,
}) => {
  // Lock dello scroll quando il modale è aperto per evitare l'effetto "bande bianche" muovendo la pagina
  React.useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  if (!appointment) return null;

  return (
    /* OVERLAY: h-[100dvh] per gestire perfettamente il notch e le barre di Safari su iPhone */
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center w-full h-[100dvh] bg-black/60 backdrop-blur-md transition-all p-4"
      onClick={onClose}
    >
      {/* CONTENITORE MODALE: shadow-2xl e bordi ultra-arrotondati */}
      <div 
        className="relative bg-white dark:bg-zinc-900 w-full max-w-sm sm:max-w-md rounded-[38px] shadow-[0_20px_50px_rgba(0,0,0,0.3)] border border-white/20 dark:border-zinc-800 flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in duration-300"
        onClick={(e) => e.stopPropagation()} // Impedisce la chiusura cliccando dentro il modale
      >
        
        {/* HEADER PULITO */}
        <div className="flex justify-between items-center px-8 pt-8 pb-4 shrink-0">
          <h2 className="text-2xl font-black text-zinc-900 dark:text-zinc-50 tracking-tight">Dettagli Appuntamento</h2>
          <button 
            onClick={onClose} 
            className="p-2 bg-zinc-100 dark:bg-zinc-800 rounded-full text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors h-10 w-10 flex items-center justify-center appearance-none"
          >
            <X size={20} />
          </button>
        </div>

        <div className="px-8 pb-8 pt-2 space-y-5 overflow-y-auto scrollbar-hide">
          
          {/* SCHEDA PROFILO */}
          <div className="flex items-center gap-4 p-5 rounded-[32px] bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-700">
            <div
              className="w-14 h-14 rounded-[22px] flex items-center justify-center text-white shrink-0 shadow-lg"
              style={{ backgroundColor: appointment.trainers?.color || '#3b82f6' }}
            >
              <User size={28} />
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                {appointment.cliente_id ? (
                  <Link 
                    href={`/clienti/${appointment.cliente_id}`}
                    onClick={onClose}
                    className="text-xl font-black text-zinc-900 dark:text-zinc-50 hover:text-blue-600 dark:hover:text-blue-400 transition-colors truncate"
                  >
                    {appointment.client_name}
                  </Link>
                ) : (
                  <h3 className="text-xl font-black text-zinc-900 dark:text-zinc-50 truncate">
                    {appointment.client_name}
                  </h3>
                )}
                <ExternalLink size={14} className="text-zinc-400 shrink-0" />
              </div>

              <div className="flex items-center gap-3 mt-1.5 overflow-x-auto scrollbar-hide">
                <a 
                  href={`tel:${appointment.phone}`}
                  className="flex items-center text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 text-[11px] font-bold uppercase tracking-wider transition-colors shrink-0"
                >
                  <Phone size={14} className="mr-1" /> CHIAMA
                </a>
                <a 
                  href={`https://wa.me/${appointment.phone?.replace(/\D/g, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center text-emerald-600 dark:text-emerald-500 text-[11px] font-bold uppercase tracking-wider transition-colors shrink-0"
                >
                  <span className="mr-1 text-sm">💬</span> WHATSAPP
                </a>
              </div>

              {/* BADGE ISTRUTTORE */}
              <div className="mt-2.5 inline-flex items-center gap-1.5 py-1 px-3 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm">
                <span className="text-[10px]">🎓</span>
                <span className="text-[9px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-tighter">
                  ISTRUTTORE: <span className="text-zinc-900 dark:text-zinc-100 ml-1">{appointment.trainers?.name || 'NON ASSEGNATO'}</span>
                </span>
              </div>
            </div>
          </div>

          {/* GRID INFO */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-800 p-4 rounded-3xl shadow-sm">
              <span className="text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest flex items-center gap-1 mb-2">
                <CalendarIcon size={12} /> DATA E ORA
              </span>
              <div className="text-sm font-bold text-zinc-900 dark:text-zinc-50">{new Date(appointment.appointment_date).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
              <div className="text-blue-600 dark:text-blue-400 font-black text-sm mt-0.5">{appointment.appointment_time.slice(0, 5)} - {appointment.duration || 60}m</div>
            </div>

            <div className="bg-white dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-800 p-4 rounded-3xl shadow-sm">
              <span className="text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest flex items-center gap-1 mb-2">
                <Car size={12} /> VEICOLO
              </span>
              <div className="text-sm font-bold text-zinc-900 dark:text-zinc-50 uppercase truncate">{appointment.license_type} • {appointment.gearbox_type}</div>
              <div 
                className="mt-2 inline-flex items-center px-2 py-0.5 rounded-md text-[9px] font-black uppercase text-white"
                style={{ backgroundColor: appointment.vehicle_color || '#4b5563' }}
              >
                {appointment.vehicle_id.split(' (')[0]}
              </div>
            </div>
          </div>

          {/* NOTE */}
          <div className="bg-zinc-50/50 dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-800 rounded-3xl p-5 min-h-[100px]">
             <span className="text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest flex items-center gap-1 mb-2">
               <FileText size={12} /> NOTE
             </span>
             <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-snug italic whitespace-pre-wrap">
                {appointment.notes || 'Nessuna nota presente.'}
             </p>
          </div>

          {/* AZIONI - h-11 obbligatorio per iOS */}
          <div className="grid grid-cols-2 gap-2 pt-2">
            <button 
              onClick={() => onEdit?.(appointment)} 
              className="h-11 bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400 font-black rounded-2xl text-[10px] uppercase tracking-wider transition-transform active:scale-95"
            >
              MODIFICA
            </button>
            <button 
              onClick={() => onCancelGuide?.(appointment.id)} 
              className="h-11 bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-400 font-black rounded-2xl text-[10px] uppercase tracking-wider transition-transform active:scale-95"
            >
              ANNULLA
            </button>
            <button 
              onClick={() => onDelete?.(appointment.id)} 
              className="h-11 bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400 font-black rounded-2xl text-[10px] uppercase tracking-wider transition-transform active:scale-95"
            >
              ELIMINA
            </button>
            <button 
              onClick={onClose} 
              className="h-11 bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900 font-black rounded-2xl text-[10px] uppercase tracking-wider transition-transform active:scale-95 shadow-lg"
            >
              CHIUDI
            </button>
          </div>

        </div>
      </div>
    </div>
  );
};
