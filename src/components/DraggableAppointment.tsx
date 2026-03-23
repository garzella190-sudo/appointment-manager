'use client';

import React from 'react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { AlertTriangle, StickyNote } from 'lucide-react';
import { Appointment } from '@/types';
import { cn } from '@/lib/utils';

interface DraggableAppointmentProps {
  appointment: Appointment;
  isOverlapping?: boolean;
  onClick?: (appointment: Appointment) => void;
  isStacked?: boolean;
  isFirst?: boolean;
  granularity?: number;
}

export const DraggableAppointment = ({ appointment, isOverlapping, onClick, isStacked, isFirst, granularity = 15 }: DraggableAppointmentProps) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: appointment.id,
    data: appointment
  });

  const style = isDragging ? {
    opacity: 0,
  } : {
    transform: CSS.Translate.toString(transform),
  };

  return (
    <div 
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={(e) => {
        e.stopPropagation();
        if (onClick) onClick(appointment);
      }}
      className={cn(
        "relative w-full p-1.5 mb-1 rounded-xl cursor-grab active:cursor-grabbing transition-all z-[20] shadow-sm flex flex-col justify-between border-l-4",
        isDragging ? "invisible" : "hover:scale-[1.02] hover:shadow-lg hover:z-[30]",
        appointment.is_unavailability ? "bg-zinc-200 dark:bg-zinc-700/50" : "bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md",
        isOverlapping && "ring-2 ring-red-500 animate-pulse bg-red-500/10 dark:bg-red-500/20"
      )}
      style={{ 
        ...style,
        height: isStacked ? 'auto' : `${(appointment.duration / 15) * 40 - 2}px`,
        minHeight: isStacked ? '36px' : undefined,
        marginTop: (isStacked && !isFirst) ? '-4px' : undefined,
        borderLeftColor: isOverlapping ? '#ef4444' : (appointment.istruttore?.color || '#3b82f6'),
        boxShadow: isOverlapping ? '0 0 20px rgba(239, 68, 68, 0.2)' : `0 4px 12px -2px ${appointment.istruttore?.color}20`,
        borderRight: appointment.vehicle_color ? `4px solid ${appointment.vehicle_color}` : undefined,
      } as React.CSSProperties}
    >
      <div>
        <div className="flex items-start justify-between gap-1">
          <p className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-zinc-100 leading-tight truncate">
            {appointment.client_name}
          </p>
          <div className="flex items-center gap-1 shrink-0">
            {appointment.notes && appointment.notes.trim() !== '' && (
              <StickyNote size={14} className="text-blue-500/70 dark:text-blue-400/70" />
            )}
            {isOverlapping && (
              <AlertTriangle size={14} className="text-red-600 dark:text-red-400 shrink-0" />
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 mt-1 sm:mt-1.5">
          <span className="text-[10px] sm:text-xs font-bold uppercase py-0.5 px-1.5 bg-white dark:bg-black/20 rounded text-zinc-800 dark:text-zinc-200">
            {appointment.license_type}
          </span>
          <span className="text-[10px] sm:text-xs font-semibold opacity-80 text-zinc-800 dark:text-zinc-300">
            {appointment.appointment_time.slice(0, 5)}
          </span>
        </div>
      </div>
    </div>
  );
};
