'use client';

import React from 'react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { AlertTriangle } from 'lucide-react';
import { Appointment } from '@/types';
import { cn } from '@/lib/utils';

interface DraggableAppointmentProps {
  appointment: Appointment;
  isOverlapping?: boolean;
  onClick?: (appointment: Appointment) => void;
}

export const DraggableAppointment = ({ appointment, isOverlapping, onClick }: DraggableAppointmentProps) => {
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
        "absolute inset-0.5 p-1 rounded-md cursor-grab active:cursor-grabbing transition-all z-10 overflow-hidden shadow-sm flex flex-col justify-between",
        isDragging ? "invisible" : "hover:scale-[1.01] hover:shadow-md",
        appointment.is_unavailability ? "bg-zinc-200 dark:bg-zinc-700" : "bg-blue-500/10 border-l-2",
        isOverlapping && "ring-2 ring-red-500 animate-pulse bg-red-500/10 dark:bg-red-500/20"
      )}
      style={{ 
        ...style,
        borderLeftColor: isOverlapping ? '#ef4444' : (appointment.trainers?.color || '#3b82f6'),
        backgroundColor: (appointment.trainers?.color && !isDragging && !isOverlapping ? appointment.trainers.color + '15' : undefined),
        borderRight: appointment.vehicle_color ? `3px solid ${appointment.vehicle_color}` : undefined
      }}
    >
      <div>
        <div className="flex items-start justify-between gap-1">
          <p className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-zinc-100 leading-tight">
            {appointment.client_name}
          </p>
          {isOverlapping && (
            <AlertTriangle size={14} className="text-red-600 dark:text-red-400 shrink-0" />
          )}
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
