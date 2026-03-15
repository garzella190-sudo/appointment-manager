'use client';

import React, { forwardRef } from 'react';
import ReactDatePicker, { registerLocale } from 'react-datepicker';
import { it } from 'date-fns/locale/it';
import { Calendar as CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import "react-datepicker/dist/react-datepicker.css";

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
        popperPlacement="bottom-start"
      />
      <CalendarIcon 
        size={16} 
        className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-blue-500 transition-colors pointer-events-none" 
      />
    </div>
  );
};

export default DatePicker;
