'use client';

import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CalendarProps {
  selectedDate: string;
  onDateSelect: (date: string) => void;
}

/**
 * Custom Calendar Component - Optimized for iOS and Dark Mode
 * Protocollo: Border-only selection, z-index number visibility, h-11 compatibility (touch targets).
 */
export const Calendar: React.FC<CalendarProps> = ({ selectedDate, onDateSelect }) => {
  const daysHeader = ['lun', 'mar', 'mer', 'gio', 'ven', 'sab', 'dom'];
  
  // Esempio: Marzo 2026 (Logica di layout fornita dall'utente)
  // Nota: In produzione questa logica dovrebbe derivare da date-fns per gestire ogni mese.
  const daysInMonth = Array.from({ length: 31 }, (_, i) => i + 1);

  return (
    <div className="bg-white dark:bg-zinc-950 rounded-2xl p-4 shadow-xl border border-zinc-100 dark:border-zinc-800 max-w-[320px] animate-fade-in">
      {/* HEADER MESE */}
      <div className="flex justify-between items-center mb-4 px-2">
        <button 
          type="button"
          title="Mese precedente"
          className="p-1.5 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded-lg transition-colors appearance-none"
        >
          <ChevronLeft size={20} />
        </button>
        <h3 className="text-sm font-black text-zinc-900 dark:text-zinc-50 capitalize tracking-tight">
          marzo 2026
        </h3>
        <button 
          type="button"
          title="Mese successivo"
          className="p-1.5 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded-lg transition-colors appearance-none"
        >
          <ChevronRight size={20} />
        </button>
      </div>

      {/* HEADER GIORNI SETTIMANA */}
      <div className="grid grid-cols-7 mb-2 border-b border-zinc-50 dark:border-zinc-900 pb-2">
        {daysHeader.map((d) => (
          <div key={d} className="text-center text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">
            {d}
          </div>
        ))}
      </div>

      {/* GRIGLIA GIORNI */}
      <div className="grid grid-cols-7 gap-y-1">
        {daysInMonth.map((day) => {
          // Normalizzazione data per confronto (YYYY-MM-DD)
          const formattedDay = `2026-03-${day.toString().padStart(2, '0')}`;
          const isSelected = selectedDate === formattedDay;
          
          return (
            <div key={day} className="flex justify-center items-center py-1">
              <button
                type="button"
                onClick={() => onDateSelect(formattedDay)}
                className={cn(
                  "relative h-10 w-10 flex items-center justify-center text-sm rounded-full transition-all appearance-none",
                  isSelected 
                    ? "border-2 border-blue-600 text-blue-600 font-bold bg-blue-50 dark:bg-blue-500/10 shadow-sm"
                    : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-900"
                )}
              >
                {/* Lo span assicura che il numero sia sempre sopra ogni stile grazie allo z-index: 10 */}
                <span className="relative z-10">{day}</span>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Calendar;
