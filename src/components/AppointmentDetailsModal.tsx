'use client';

import React from 'react';
import { Appointment } from '@/types';

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
  if (!appointment) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-opacity overflow-y-auto">
      <div className="bg-white rounded-[32px] w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200 my-auto sm:max-h-[90vh] flex flex-col">
        
        {/* HEADER MODALE */}
        <div className="flex justify-between items-center p-6 pb-2 shrink-0">
          <h2 className="text-xl font-extrabold text-gray-900 tracking-tight">Dettagli Appuntamento</h2>
          <button 
            onClick={onClose} 
            className="p-2 bg-gray-100 rounded-full text-gray-500 hover:bg-gray-200 transition-colors h-10 w-10 flex items-center justify-center appearance-none"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* CONTENT (Scrollable on small screens) */}
        <div className="p-6 pt-2 space-y-4 overflow-y-auto custom-scrollbar">
          
          {/* SCHEDA CLIENTE E ISTRUTTORE */}
          <div className="bg-gray-50/80 rounded-3xl p-5 border border-gray-100 shadow-sm">
            <div className="flex items-start gap-4">
              <div className="h-14 w-14 bg-blue-600 rounded-2xl flex items-center justify-center text-white shrink-0 shadow-lg shadow-blue-200">
                <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                </svg>
              </div>
              
              <div className="flex flex-col flex-1">
                <h3 className="text-xl font-bold text-gray-900 leading-tight">
                  {appointment.client_name}
                </h3>
                
                {/* AZIONI RAPIDE CONTATTO */}
                <div className="flex flex-wrap gap-3 mt-1.5 mb-3">
                  <a 
                    href={`tel:${appointment.phone}`}
                    className="flex items-center text-green-600 text-[11px] font-black uppercase tracking-widest hover:opacity-70 transition-opacity"
                  >
                    <span className="mr-1 text-sm">📞</span> Chiama
                  </a>
                  <a 
                    href={`https://wa.me/${appointment.phone?.replace(/\D/g, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center text-emerald-500 text-[11px] font-black uppercase tracking-widest hover:opacity-70 transition-opacity"
                  >
                    <span className="mr-1 text-sm">💬</span> WhatsApp
                  </a>
                </div>

                {/* BADGE ISTRUTTORE */}
                <div className="flex items-center gap-2 py-1.5 px-3 bg-white border border-amber-200 rounded-xl w-fit shadow-sm">
                  <span className="text-xs">🎓</span>
                  <span className="text-[11px] font-black text-gray-800 uppercase tracking-tighter">
                    Istruttore: <span className="text-amber-600 ml-1">{appointment.trainers?.name || 'Non Assegnato'}</span>
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* GRIGLIA INFO DATA/VEICOLO */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white border border-gray-100 p-4 rounded-2xl shadow-sm">
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">📅 Data e Ora</span>
              <div className="text-sm font-bold text-gray-900">{new Date(appointment.appointment_date).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
              <div className="text-blue-600 font-extrabold text-sm">{appointment.appointment_time} - ({appointment.duration || 60} min)</div>
            </div>

            <div className="bg-white border border-gray-100 p-4 rounded-2xl shadow-sm">
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">🚗 Veicolo e Patente</span>
              <div className="text-sm font-bold text-gray-900 uppercase">{appointment.license_type} • {appointment.gearbox_type}</div>
              <div className="mt-1 inline-flex items-center px-2 py-0.5 rounded-md bg-pink-100 text-pink-600 text-[10px] font-black uppercase tracking-tighter">
                {appointment.vehicle_id}
              </div>
            </div>
          </div>

          {/* SEZIONE NOTE */}
          <div className="bg-white border border-gray-100 rounded-2xl p-4 relative group">
             <div className="flex justify-between items-center mb-1">
                <span className="text-[10px] font-black text-gray-400 uppercase flex items-center tracking-widest">
                   📝 Note
                </span>
             </div>
             <p className="text-sm text-gray-600 leading-relaxed italic">
                {appointment.notes || 'Nessuna nota per questa guida.'}
             </p>
          </div>

          {/* PULSANTI AZIONE (iOS h-11) */}
          <div className="flex flex-wrap gap-2 pt-2">
            <button 
              onClick={() => onEdit?.(appointment)}
              className="flex-1 h-11 bg-blue-50 text-blue-600 font-black rounded-2xl text-[11px] uppercase tracking-wider hover:bg-blue-100 transition-all active:scale-95 appearance-none"
            >
              Modifica
            </button>
            <button 
              onClick={() => onCancelGuide?.(appointment.id)}
              className="flex-1 h-11 bg-amber-50 text-amber-600 font-black rounded-2xl text-[11px] uppercase tracking-wider hover:bg-amber-100 transition-all active:scale-95 appearance-none"
            >
              Annulla
            </button>
            <button 
              onClick={() => onDelete?.(appointment.id)}
              className="flex-1 h-11 bg-red-50 text-red-600 font-black rounded-2xl text-[11px] uppercase tracking-wider hover:bg-red-100 transition-all active:scale-95 appearance-none"
            >
              Elimina
            </button>
            <button 
              onClick={onClose} 
              className="h-11 px-6 bg-gray-900 text-white font-black rounded-2xl text-[11px] uppercase tracking-wider hover:bg-black transition-all active:scale-95 appearance-none"
            >
              Chiudi
            </button>
          </div>

        </div>
      </div>
    </div>
  );
};
