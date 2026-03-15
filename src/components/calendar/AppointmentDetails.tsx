'use client';

import React, { useState, useEffect } from 'react';
import { format, parseISO, addMinutes } from 'date-fns';
import { it } from 'date-fns/locale';
import { User, Phone, Calendar as CalendarIcon, Car, FileText, Pencil, Save, X, Loader2, ExternalLink } from 'lucide-react';
import { Appointment } from '@/types';
import { cn } from '@/lib/utils';
import { PhoneActions } from '@/components/PhoneActions';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

interface AppointmentDetailsProps {
  appointment: Appointment;
  onRefresh: () => void;
  onEdit: () => void;
  onCancel: () => void;
  onDelete: () => void;
  onClose: () => void;
}

export const AppointmentDetails = ({
  appointment,
  onRefresh,
  onEdit,
  onCancel,
  onDelete,
  onClose
}: AppointmentDetailsProps) => {
  const router = useRouter();
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [notes, setNotes] = useState(appointment.notes || '');
  const [isSavingNotes, setIsSavingNotes] = useState(false);

  // Sync notes when appointment prop changes (real-time refresh support)
  useEffect(() => {
    setNotes(appointment.notes || '');
  }, [appointment.notes]);

  const handleSaveNotes = async () => {
    setIsSavingNotes(true);
    const { error } = await supabase
      .from('appuntamenti')
      .update({ note: notes })
      .eq('id', appointment.id);

    setIsSavingNotes(false);
    if (!error) {
      setIsEditingNotes(false);
      onRefresh();
    } else {
      alert('Errore durante il salvataggio delle note');
    }
  };

  const handleGoToClient = () => {
    if (appointment.cliente_id) {
      onClose();
      router.push(`/clienti/${appointment.cliente_id}`);
    } else {
      alert('ID Cliente non trovato. Ricarica la pagina.');
    }
  };

  const startTime = parseISO(`${appointment.appointment_date}T${appointment.appointment_time}`);
  const endTime = addMinutes(startTime, appointment.duration);
  const vehicleDisplay = appointment.vehicle_id.split(' (')[0];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-700">
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center text-white shrink-0 shadow-lg"
          style={{ backgroundColor: appointment.trainers?.color || '#3b82f6' }}
        >
          <User size={24} />
        </div>
        <div className="min-w-0 flex-1">
          <button 
            type="button"
            onClick={handleGoToClient}
            className={cn(
              "group inline-flex items-center gap-2 text-lg font-black text-zinc-900 dark:text-zinc-50 hover:text-blue-600 dark:hover:text-blue-400 transition-colors text-left",
              ((appointment as any).stato === 'annullato') && "line-through opacity-70"
            )}
          >
            <span className="truncate group-hover:underline decoration-2 underline-offset-4 font-bold">
              {appointment.client_name}
            </span>
            <ExternalLink size={16} className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>
          <div className="flex items-center gap-3 mt-1">
            <p className="text-sm text-zinc-500 flex items-center gap-1">
              <Phone size={14} /> {appointment.phone || 'Nessun numero'}
            </p>
            {appointment.phone && <PhoneActions phone={appointment.phone} secondary />}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="p-4 rounded-2xl border border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-sm">
          <p className="text-[10px] uppercase font-bold text-zinc-400 mb-1 flex items-center gap-1">
            <CalendarIcon size={12} /> Data e Ora
          </p>
          <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
            {format(parseISO(appointment.appointment_date), 'dd MMMM yyyy', { locale: it })}
          </p>
          <p className="text-sm text-blue-600 dark:text-blue-400 font-bold mt-0.5">
            {appointment.appointment_time.slice(0, 5)} - {format(endTime, 'HH:mm')} ({appointment.duration} min)
          </p>
        </div>

        <div className="p-4 rounded-2xl border border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-sm">
          <p className="text-[10px] uppercase font-bold text-zinc-400 mb-1 flex items-center gap-1">
            <Car size={12} /> Veicolo e Patente
          </p>
          <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
            {appointment.license_type} • <span className="uppercase opacity-70">{appointment.gearbox_type}</span>
          </p>
          <div 
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold text-white mt-2"
            style={{ backgroundColor: appointment.vehicle_color || '#4b5563' }}
          >
            <Car size={10} /> {vehicleDisplay}
          </div>
        </div>
      </div>

      <div className="p-4 rounded-2xl border border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-sm min-h-[120px]">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] uppercase font-bold text-zinc-400 flex items-center gap-1">
            <FileText size={12} /> Note
          </p>
          {!isEditingNotes ? (
            <button
              onClick={() => setIsEditingNotes(true)}
              className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-blue-500 transition-all"
            >
              <Pencil size={14} />
            </button>
          ) : (
            <div className="flex items-center gap-1">
              <button
                onClick={handleSaveNotes}
                disabled={isSavingNotes}
                className="p-1.5 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg text-emerald-600 dark:text-emerald-400"
              >
                {isSavingNotes ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              </button>
              <button
                onClick={() => setIsEditingNotes(false)}
                className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-red-600 dark:text-red-400"
              >
                <X size={14} />
              </button>
            </div>
          )}
        </div>
        
        {isEditingNotes ? (
          <textarea
            className="w-full p-3 text-sm rounded-xl border border-blue-200 dark:border-blue-900/50 bg-blue-50/30 dark:bg-blue-950/20 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500/20 outline-none resize-none min-h-[80px]"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            autoFocus
          />
        ) : (
          <p className="text-sm italic text-zinc-600 dark:text-zinc-400 whitespace-pre-wrap">
            {appointment.notes || 'Nessuna nota.'}
          </p>
        )}
      </div>

      <div className="flex flex-wrap gap-2 mt-4">
        <button
          onClick={onEdit}
          className="flex-1 min-w-[100px] h-11 rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400 font-bold hover:bg-blue-100 transition-all text-sm appearance-none"
        >
          Modifica
        </button>
        <button
          onClick={onCancel}
          disabled={(appointment as any).stato === 'annullato'}
          className="flex-1 min-w-[100px] h-11 rounded-xl bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-400 font-bold hover:bg-orange-100 transition-all text-sm disabled:opacity-50 appearance-none"
        >
          Annulla
        </button>
        <button
          onClick={onDelete}
          className="flex-1 min-w-[100px] h-11 rounded-xl bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400 font-bold hover:bg-red-100 transition-all text-sm appearance-none"
        >
          Elimina
        </button>
        <button
          onClick={onClose}
          className="w-full sm:w-auto px-6 h-11 rounded-xl bg-zinc-900 dark:bg-zinc-50 dark:text-zinc-900 text-white font-bold transition-all shadow-lg text-sm appearance-none mt-2 sm:mt-0"
        >
          Chiudi
        </button>
      </div>
    </div>
  );
};
