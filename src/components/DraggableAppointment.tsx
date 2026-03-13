'use client';

import React from 'react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { Appointment } from '@/types';
import { cn } from '@/lib/utils';

interface DraggableAppointmentProps {
  appointment: Appointment;
  onClick?: (appointment: Appointment) => void;
}

export const DraggableAppointment = ({ appointment, onClick }: DraggableAppointmentProps) => {
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
        "absolute inset-0.5 p-1 rounded-md cursor-grab active:cursor-grabbing transition-all z-10 overflow-hidden shadow-sm",
        isDragging ? "invisible" : "hover:scale-[1.01] hover:shadow-md",
        appointment.is_unavailability ? "bg-zinc-200 dark:bg-zinc-700" : "bg-blue-500/10 border-l-2"
      )}
      style={{ 
        ...style,
        borderLeftColor: appointment.trainers?.color || '#3b82f6',
        backgroundColor: (appointment.trainers?.color && !isDragging ? appointment.trainers.color + '15' : undefined)
      }}
    >
      <p className="text-[10px] font-bold text-zinc-900 dark:text-zinc-100 leading-tight">
        {appointment.client_name}
      </p>
      <div className="flex items-center gap-1 mt-1">
        <span className="text-[8px] font-bold uppercase py-0.5 px-1 bg-white dark:bg-black/20 rounded">
          {appointment.license_type}
        </span>
        <span className="text-[8px] opacity-70">
          {appointment.appointment_time.slice(0, 5)}
        </span>
      </div>
    </div>
  );
};
