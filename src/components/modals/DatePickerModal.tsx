import React, { useState, useEffect } from 'react';
import { Modal } from '@/components/Modal';
import { ChevronLeft, ChevronRight, X, Calendar as CalendarIcon } from 'lucide-react';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek, isSameDay, isSameMonth, isToday } from 'date-fns';
import { it } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { isItalianHoliday, isWeekend } from '@/utils/holidays';

interface DatePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDate: Date;
  onSelect: (date: Date) => void;
}

export default function DatePickerModal({ isOpen, onClose, selectedDate, onSelect }: DatePickerModalProps) {
  const [currentMonth, setCurrentMonth] = useState(selectedDate);

  useEffect(() => {
    if (isOpen) {
      setCurrentMonth(selectedDate);
    }
  }, [isOpen, selectedDate]);

  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const dateFormat = "MMMM yyyy";
  const days = eachDayOfInterval({
    start: startDate,
    end: endDate
  });

  const weekDays = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Scegli Data">
      <div className="flex flex-col w-full">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={prevMonth}
            className="p-2.5 bg-zinc-50 hover:bg-zinc-100 dark:bg-zinc-800/50 dark:hover:bg-zinc-800 rounded-xl transition-all text-zinc-600 dark:text-zinc-400"
            title="Mese precedente"
          >
            <ChevronLeft size={20} />
          </button>
          
          <div className="flex flex-col items-center">
            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">
              Vai a un giorno specifico
            </p>
            <h3 className="text-lg sm:text-xl font-black text-zinc-900 dark:text-zinc-100 uppercase tracking-wider leading-none">
              {format(currentMonth, dateFormat, { locale: it })}
            </h3>
          </div>

          <button
            onClick={nextMonth}
            className="p-2.5 bg-zinc-50 hover:bg-zinc-100 dark:bg-zinc-800/50 dark:hover:bg-zinc-800 rounded-xl transition-all text-zinc-600 dark:text-zinc-400"
            title="Mese successivo"
          >
            <ChevronRight size={20} />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1 mb-1">
          {weekDays.map(day => (
            <div key={day} className="text-center text-[10px] font-black uppercase text-zinc-400">
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1 content-start">
          {days.map((day) => {
            const isSelected = isSameDay(day, selectedDate);
            const isCurrentMonth = isSameMonth(day, currentMonth);
            const isTodayDate = isToday(day);
            const holiday = isItalianHoliday(day) || isWeekend(day);

            return (
              <button
                key={day.toString()}
                onClick={() => {
                  onSelect(day);
                  onClose();
                }}
                className={cn(
                  "w-full h-10 sm:h-12 flex items-center justify-center rounded-xl text-[14px] sm:text-base font-black transition-all leading-none",
                  !isCurrentMonth && "opacity-20 scale-95",
                  isSelected 
                    ? "bg-sky-500 text-white shadow-[0_5px_15px_-5px_rgba(14,165,233,0.8)] scale-110 z-10"
                    : isTodayDate
                      ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 ring-2 ring-zinc-100 dark:ring-zinc-800"
                      : "bg-zinc-50 dark:bg-zinc-800/30 hover:bg-zinc-100 dark:hover:bg-zinc-700/50",
                  !isSelected && !isTodayDate && holiday && "text-red-500",
                  !isSelected && !isTodayDate && !holiday && "text-zinc-700 dark:text-zinc-300"
                )}
              >
                {format(day, 'd')}
              </button>
            );
          })}
        </div>
      </div>
    </Modal>
  );
}
