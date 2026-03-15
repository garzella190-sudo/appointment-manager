'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Appointment } from '@/types';
import { supabase } from '@/lib/supabase';
import { X, Phone, User, Calendar as CalendarIcon, Car, FileText, ExternalLink, Loader2, Trash2, Edit3, MessageCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, parseISO, addMinutes } from 'date-fns';
import { it } from 'date-fns/locale';
import Link from 'next/link';

interface AppointmentDetailsModalProps {
  appointment: Appointment;
  onClose: () => void;
  onUpdate: () => void;
  onEdit?: (app: Appointment) => void;
  onDelete?: (id: string) => void;
}

export const AppointmentDetailsModal: React.FC<AppointmentDetailsModalProps> = ({
  appointment,
  onClose,
  onUpdate,
  onEdit,
  onDelete
}) => {
  const [mounted, setMounted] = useState(false);
  const [note, setNote] = useState(appointment.notes || '');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setMounted(true);
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  // --- LOGICA NOTE REAL-TIME ---
  useEffect(() => {
    if (!mounted) return;
    
    const delayDebounceFn = setTimeout(async () => {
      if (note !== appointment.notes) {
        setIsSaving(true);
        try {
          const { error } = await supabase
            .from('appuntamenti')
            .update({ note: note })
            .eq('id', appointment.id);
          
          if (!error) {
            onUpdate();
          }
        } catch (err) {
          console.error("Error saving note:", err);
        } finally {
          setIsSaving(false);
        }
      }
    }, 1000);

    return () => clearTimeout(delayDebounceFn);
  }, [note, appointment.id, appointment.notes, onUpdate, mounted]);

  if (!mounted) return null;

  // --- LOGICA ANNULLA GUIDA ---
  const handleCancel = async () => {
    const confirm = window.confirm("Vuoi annullare questa guida?");
    if (confirm) {
      const { error } = await supabase
        .from('appuntamenti')
        .update({ stato: 'annullato' })
        .eq('id', appointment.id);
      
      if (!error) {
        onUpdate();
        onClose();
      }
    }
  };

  // --- LOGICA STATO AUTOMATICO (SVOLTO) ---
  const checkIsCompleted = () => {
    if (appointment.status === 'cancelled' || (appointment as any).stato === 'annullato') return false;
    const now = new Date();
    const startTime = parseISO(`${appointment.appointment_date}T${appointment.appointment_time}`);
    const endTime = addMinutes(startTime, appointment.duration || 60);
    return now > endTime;
  };

  const isCompleted = checkIsCompleted();
  const vehicleDisplay = appointment.vehicle_id.split(' (')[0];

  const modalContent = (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md h-[100dvh]" onClick={onClose}>
      <div 
        className="bg-[#1c1c1e] text-white rounded-[32px] w-full max-w-sm border border-gray-800 shadow-2xl overflow-hidden animate-in zoom-in duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* HEADER */}
        <div className="flex justify-between items-center p-6 pb-2">
          <h2 className="text-xl font-bold tracking-tight">Dettagli Guida</h2>
          <button onClick={onClose} className="p-2 bg-gray-800 rounded-full h-10 w-10 flex items-center justify-center hover:bg-gray-700 transition-all">
            <X size={20} className="text-gray-400" />
          </button>
        </div>

        <div className="p-6 pt-2 space-y-4">
          
          {/* SCHEDA CLIENTE & ISTRUTTORE */}
          <div className="bg-[#2c2c2e] rounded-3xl p-5 border border-gray-700/50">
            <div className="flex items-center gap-4">
              <div 
                className="h-14 w-14 rounded-full flex items-center justify-center shrink-0 shadow-lg text-white"
                style={{ backgroundColor: appointment.trainers?.color || '#3b82f6' }}
              >
                <User size={30} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                   <Link 
                    href={`/clienti/${appointment.cliente_id}`}
                    onClick={onClose}
                    className="text-lg font-bold truncate hover:text-blue-400 transition-colors"
                  >
                    {appointment.client_name}
                  </Link>
                  <ExternalLink size={14} className="text-gray-500 shrink-0" />
                </div>
                
                <div className="flex gap-4 my-1">
                  <a href={`tel:${appointment.phone}`} className="text-[10px] font-black text-blue-400 uppercase flex items-center gap-1">
                    <Phone size={10} /> Chiama
                  </a>
                  <a 
                    href={`https://wa.me/${appointment.phone?.replace(/\D/g, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] font-black text-emerald-400 uppercase flex items-center gap-1"
                  >
                    <MessageCircle size={10} /> WhatsApp
                  </a>
                </div>
                
                {/* BADGE ISTRUTTORE */}
                <div className="flex items-center gap-2 py-1 px-3 mt-2 border border-gray-600/50 rounded-xl bg-black/20 w-fit">
                  <span className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter">
                    ISTRUTTORE: <span className="text-white ml-1 font-black">{appointment.trainers?.name || 'NON ASSEGNATO'}</span>
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* GRID INFO (Data/Veicolo) */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[#2c2c2e] p-4 rounded-3xl border border-gray-700/30">
              <span className="text-[9px] font-bold text-gray-500 uppercase block mb-1">📅 Data e Ora</span>
              <div className="text-xs font-bold leading-tight">
                {format(parseISO(appointment.appointment_date), 'dd MMM yyyy', { locale: it })}
              </div>
              <div className="text-blue-400 font-black text-xs mt-1">
                {appointment.appointment_time.slice(0, 5)} - {appointment.duration}m
              </div>
            </div>
            
            <div className="bg-[#2c2c2e] p-4 rounded-3xl border border-gray-700/30">
              <span className="text-[9px] font-bold text-gray-500 uppercase block mb-1">🚗 Veicolo</span>
              <div className="text-xs font-bold uppercase truncate">{appointment.license_type} • {appointment.gearbox_type === 'Automatic' ? 'Automatico' : 'Manuale'}</div>
              <div 
                className="mt-1.5 inline-flex px-2 py-0.5 rounded bg-pink-500/20 text-pink-400 text-[9px] font-black uppercase tracking-tighter"
                style={appointment.vehicle_color ? { backgroundColor: `${appointment.vehicle_color}20`, color: appointment.vehicle_color } : {}}
              >
                {vehicleDisplay}
              </div>
            </div>
          </div>

          {/* NOTE REAL-TIME */}
          <div className="bg-[#2c2c2e] rounded-3xl p-4 border border-gray-700/30 relative">
             <div className="flex justify-between items-center mb-2">
                <span className="text-[9px] font-bold text-gray-500 uppercase flex items-center gap-1">
                  <FileText size={10} /> Note
                </span>
                {isSaving && (
                  <div className="flex items-center gap-1">
                    <Loader2 size={10} className="animate-spin text-blue-400" />
                    <span className="text-[8px] text-blue-400 font-bold uppercase">In salvataggio...</span>
                  </div>
                )}
             </div>
             <textarea 
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full bg-transparent text-sm text-gray-100 italic focus:outline-none resize-none h-16 scrollbar-hide"
                placeholder="Nessuna nota... clicca qui per aggiungere"
             />
          </div>

          {/* AZIONI (iOS h-11) */}
          <div className="grid grid-cols-2 gap-2 pt-2">
            <button 
              onClick={() => onEdit?.(appointment)}
              className="h-11 bg-blue-600/20 text-blue-400 font-black rounded-2xl text-[10px] uppercase tracking-wider active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              <Edit3 size={14} /> Modifica
            </button>
            <button 
                onClick={handleCancel}
                disabled={appointment.status === 'cancelled' || (appointment as any).stato === 'annullato'}
                className="h-11 bg-amber-600/20 text-amber-400 font-black rounded-2xl text-[10px] uppercase tracking-wider active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              Annulla
            </button>
            <button 
              onClick={() => onDelete?.(appointment.id)}
              className="h-11 bg-red-600/20 text-red-400 font-black rounded-2xl text-[10px] uppercase tracking-wider active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              <Trash2 size={14} /> Elimina
            </button>
            <button onClick={onClose} className="h-11 bg-gray-700 text-white font-black rounded-2xl text-[10px] uppercase tracking-wider active:scale-95 transition-all">
              Chiudi
            </button>
          </div>

          {/* INDICATORE STATO AUTOMATICO */}
          {isCompleted && (
            <div className="text-center pt-2">
              <span className="inline-flex items-center gap-1.5 text-[10px] font-black text-emerald-500 bg-emerald-500/10 px-4 py-1.5 rounded-full uppercase tracking-widest border border-emerald-500/20">
                ✓ Guida Svolta
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};
