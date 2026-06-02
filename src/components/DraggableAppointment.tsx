'use client';

import React from 'react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { AlertTriangle, StickyNote, Trash2, GraduationCap } from 'lucide-react';
import { Appointment } from '@/types';
import { cn } from '@/lib/utils';
import { isSameDay, parseISO, format } from 'date-fns';

interface DraggableAppointmentProps {
  appointment: Appointment;
  isOverlapping?: boolean;
  onClick?: (appointment: Appointment) => void;
  isStacked?: boolean;
  isFirst?: boolean;
  granularity?: number;
  totalColumns?: number;
}

const hexToRgba = (hex: string, alpha: number) => {
  if (!hex) return `rgba(59, 130, 246, ${alpha})`;
  hex = hex.replace('#', '');
  if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
  const r = parseInt(hex.substring(0, 2), 16) || 59;
  const g = parseInt(hex.substring(2, 4), 16) || 130;
  const b = parseInt(hex.substring(4, 6), 16) || 246;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

export const DraggableAppointment = ({ appointment, isOverlapping, onClick, isStacked, isFirst, granularity = 15, totalColumns = 1 }: DraggableAppointmentProps) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: appointment.id,
    data: appointment
  });

  const now = new Date();
  const isToday = isSameDay(parseISO(appointment.appointment_date), now);
  const [h, m] = appointment.appointment_time.split(':').map(Number);
  const startTime = new Date(now);
  startTime.setHours(h, m, 0, 0);
  const endTime = new Date(startTime.getTime() + appointment.duration * 60000);
  const isInProgress = isToday && now >= startTime && now < endTime && appointment.stato !== 'annullato';

  const style = isDragging ? {
    opacity: 0,
  } : {
    transform: CSS.Translate.toString(transform),
  };

  const instructorColor = appointment.istruttore?.color || '#3b82f6';
  const instructorInitial = appointment.istruttore?.name ? appointment.istruttore.name.trim().charAt(0).toUpperCase() : '?';

  return (
    <div 
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={(e) => {
        e.stopPropagation();
        if (onClick) {
          onClick(appointment);
        }
      }}
      className={cn(
        "relative w-full mb-1 rounded-xl cursor-grab active:cursor-grabbing transition-all z-[20] flex flex-col justify-between border",
        totalColumns > 1 ? "p-1.5" : "p-2",
        isDragging ? "invisible" : "hover:scale-[1.02] hover:shadow-lg hover:z-[30]",
        isOverlapping && "ring-2 ring-red-500 animate-pulse",
        appointment.stato === 'annullato' && "opacity-60 grayscale border-zinc-300 dark:border-zinc-700",
        isInProgress && "ring-[3px] ring-blue-600/40 border-blue-600 shadow-[0_0_15px_rgba(37,99,235,0.2)] dark:shadow-[0_0_15px_rgba(37,99,235,0.1)] animate-pulse-subtle"
      )}
      style={{ 
        ...style,
        height: isStacked ? 'auto' : `${((appointment.visualDuration ?? appointment.duration) / 15) * 40 - 2}px`,
        minHeight: isStacked ? '36px' : undefined,
        marginTop: (isStacked && !isFirst) ? '-4px' : undefined,
        backgroundColor: appointment.stato === 'annullato' ? '#f4f4f5' : hexToRgba(instructorColor, 0.15),
        borderColor: isOverlapping ? '#ef4444' : hexToRgba(instructorColor, 0.4),
        boxShadow: isOverlapping ? '0 0 20px rgba(239, 68, 68, 0.2)' : `0 4px 12px -2px ${instructorColor}20`,
        borderRight: appointment.vehicle_color ? `4px solid ${appointment.vehicle_color}` : undefined,
      } as React.CSSProperties}
    >
      <div className="overflow-hidden">
        {/* Riga 1: dot istruttore + nome cliente */}
        <div className="flex items-start justify-between gap-1">
          <div className="flex items-center gap-1 overflow-hidden">
             <div 
               className="w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px] font-black text-white shrink-0 shadow-sm"
               style={{ backgroundColor: instructorColor }}
               title={appointment.istruttore?.name}
             >
               {instructorInitial}
             </div>
             <p className={cn(
               "font-black text-zinc-900 dark:text-zinc-100 leading-tight truncate",
               totalColumns > 1 ? "text-[10px]" : "text-[11px] sm:text-[13px]",
               appointment.stato === 'annullato' && "line-through text-zinc-500 dark:text-zinc-400"
             )}>
               {appointment.client_name}
             </p>
             {appointment.exam_status && appointment.exam_status !== 'none' && (
               <GraduationCap 
                 size={totalColumns > 1 ? 10 : 14} 
                 className={cn(
                   "shrink-0",
                   appointment.exam_status === 'scheduled' ? "text-emerald-500 fill-emerald-500/10" : "text-zinc-300"
                 )} 
               />
             )}
          </div>
          
          {totalColumns === 1 && (
            <div className="flex items-center gap-1 shrink-0">
              {appointment.notes && appointment.notes.trim() !== '' && (
                <div className="flex items-center justify-center p-1 bg-amber-100 dark:bg-amber-900/40 rounded-lg text-amber-600 dark:text-amber-400 shadow-sm ring-1 ring-amber-500/20" title={appointment.notes}>
                  <StickyNote size={12} fill="currentColor" fillOpacity={0.2} />
                </div>
              )}
              {isOverlapping && (
                <AlertTriangle size={14} className="text-red-600 dark:text-red-400 shrink-0" />
              )}
            </div>
          )}
        </div>
        
        {/* Riga 2: orario + tipo patente (nascosto in modalità molto compressa) */}
        {totalColumns === 1 && (
          <div className="flex items-center gap-1 mt-0.5 opacity-80">
            <span className={cn("font-bold text-zinc-800 dark:text-zinc-300", totalColumns > 1 ? "text-[9px]" : "text-[10px]")}>
              {appointment.appointment_time.slice(0, 5)}
              {totalColumns === 1 && <> — {format(endTime, 'HH:mm')}</>}
            </span>
            {totalColumns === 1 && (
              <>
                <span className="w-1 h-1 rounded-full bg-zinc-400 dark:bg-zinc-600" />
                <span className="text-[10px] font-black uppercase tracking-wider text-zinc-500 dark:text-zinc-500">
                  {appointment.license_type}
                </span>
              </>
            )}
          </div>
        )}
        
        {/* Lista Allievi (Task List) per Esami */}
        {totalColumns === 1 && appointment.candidates && appointment.candidates.length > 0 && (
          <div className="mt-2 space-y-1">
            {appointment.candidates.map(cand => (
              <div key={cand.id} className="flex items-center gap-1.5 opacity-90 pl-1">
                <div className="w-1 h-1 rounded-full bg-emerald-500" />
                <span className="text-[10px] font-bold text-zinc-700 dark:text-zinc-300 uppercase leading-none truncate">
                  {cand.cognome} {cand.nome}
                </span>
              </div>
            ))}
          </div>
        )}
        
        {totalColumns === 1 && (
          <div className="absolute right-2 bottom-2">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (onClick) onClick(appointment);
              }}
              className="p-1 rounded-lg text-zinc-300 hover:text-red-500 hover:bg-white/50 dark:hover:bg-red-900/20 transition-all opacity-0 group-hover:opacity-100"
              title="Dettagli"
            >
              <Trash2 size={12} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
