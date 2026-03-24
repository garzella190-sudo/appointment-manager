'use client';

import React, { forwardRef } from 'react';
import ReactDatePicker, { registerLocale } from 'react-datepicker';
import { it } from 'date-fns/locale/it';
import { Calendar as CalendarIcon, Copy } from 'lucide-react';
import { cn } from '@/lib/utils';
import "react-datepicker/dist/react-datepicker.css";
import { isItalianHoliday, isWeekend } from '@/utils/holidays';

registerLocale('it', it);

interface DatePickerProps {
  selected: Date | null;
  onChange: (date: Date | null) => void;
  className?: string;
  placeholderText?: string;
  required?: boolean;
}

// Custom Input to bypass react-datepicker type issues with inputMode
const CustomInput = forwardRef<HTMLInputElement, any>(({ value, onClick, placeholder, required, className }, ref) => (
  <input
    ref={ref}
    value={value}
    onClick={onClick}
    placeholder={placeholder}
    required={required}
    readOnly
    inputMode="none"
    className={cn(
      "w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl py-2.5 px-4 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm pr-10 appearance-none h-11 cursor-pointer",
      className
    )}
  />
));
CustomInput.displayName = 'CustomInput';

const DatePicker = ({ selected, onChange, className, placeholderText, required }: DatePickerProps) => {
  // Funzione per identificare festività italiane
  const getDayClass = (date: Date) => {
    if (isItalianHoliday(date) || isWeekend(date)) return "is-holiday";
    return "";
  };

  return (
    <div className="relative group">
      <ReactDatePicker
        selected={selected}
        onChange={onChange}
        locale="it"
        dateFormat="dd/MM/yyyy"
        placeholderText={placeholderText}
        required={required}
        autoComplete="off"
        customInput={<CustomInput className={className} />}
        calendarClassName="premium-calendar"
        dayClassName={getDayClass}
        portalId="datepicker-portal"
      />
      <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
        {selected && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              const dateStr = selected.toLocaleDateString('it-IT');
              navigator.clipboard.writeText(dateStr);
              const btn = e.currentTarget;
              const originalColor = btn.style.color;
              btn.style.color = '#10b981'; // emerald-500
              setTimeout(() => { btn.style.color = originalColor; }, 1000);
            }}
            className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-blue-500 transition-all active:scale-90"
            title="Copia data"
          >
            <Copy size={14} />
          </button>
        )}
        <CalendarIcon 
          size={16} 
          className="text-zinc-400 group-focus-within:text-blue-500 transition-colors pointer-events-none" 
        />
      </div>
    </div>
  );
};

export default DatePicker;
