'use client';

import React, { useState, useEffect, useRef } from 'react';
import { ChevronRight, Search, Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { createPortal } from 'react-dom';

export interface PickerOption {
  id: string;
  label: string;
  color?: string | null;
}

interface OptionPickerProps {
  options: PickerOption[];
  value: string;
  onChange: (val: string) => void;
  /** Titolo del modale (es. "Veicolo"). */
  title: string;
  placeholder?: string;
  searchPlaceholder?: string;
  /** Icona grande dell'intestazione del modale. */
  icon?: React.ReactNode;
  /** Icona piccola del tasto che apre il modale. */
  triggerIcon?: React.ReactNode;
  emptyLabel?: string;
}

/**
 * Selettore generico in modale (bottom-sheet su mobile, card centrata su desktop).
 *
 * Base condivisa di `PatentePicker` e `VehiclePicker`: stessa grafica, stessa ricerca,
 * stesso comportamento. Non duplicare questo markup in altri componenti.
 */
export const OptionPicker = ({
  options,
  value,
  onChange,
  title,
  placeholder = 'Seleziona...',
  searchPlaceholder = 'Cerca...',
  icon,
  triggerIcon,
  emptyLabel = 'Nessun risultato',
}: OptionPickerProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [searchActive, setSearchActive] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const selected = options.find(o => o.id === value);

  const filtered = query.trim() === ''
    ? options
    : options.filter(o => o.label.toLowerCase().includes(query.toLowerCase()));

  const handleSelect = (id: string) => {
    onChange(id);
    setIsOpen(false);
    setQuery('');
    setSearchActive(false);
  };

  const handleClose = () => {
    setIsOpen(false);
    setQuery('');
    setSearchActive(false);
  };

  // Chiusura con Escape
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen]);

  const modal = isOpen && mounted ? createPortal(
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center p-4"
      onClick={handleClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />

      {/* Card — sempre centrata a schermo, mai ancorata in basso */}
      <div
        className="relative z-10 w-full max-w-sm bg-white dark:bg-zinc-900 rounded-[32px] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Intestazione */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <div className="flex items-center gap-2">
            {icon}
            <span className="font-bold text-sm text-zinc-800 dark:text-zinc-100 uppercase tracking-widest">
              {title}
            </span>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="p-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        {/* Ricerca */}
        <div className="px-4 pb-2">
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
            <input
              ref={searchRef}
              type="text"
              inputMode={searchActive ? 'text' : 'none'}
              readOnly={!searchActive}
              className="w-full bg-[#F4F4F4] dark:bg-zinc-800 rounded-[14px] pl-8 pr-4 py-2.5 text-sm font-semibold outline-none focus:ring-2 focus:ring-purple-500/20 transition-all cursor-pointer"
              placeholder={searchPlaceholder}
              value={query}
              onClick={() => setSearchActive(true)}
              onTouchEnd={e => {
                e.preventDefault();
                setSearchActive(true);
                searchRef.current?.focus();
              }}
              onChange={e => setQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Elenco */}
        <div className="max-h-[260px] overflow-y-auto px-3 pb-4 space-y-0.5">
          {filtered.length === 0 ? (
            <p className="py-6 text-center text-xs text-zinc-400 italic">{emptyLabel}</p>
          ) : (
            filtered.map(opt => {
              const isSelected = opt.id === value;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => handleSelect(opt.id)}
                  className={cn(
                    'w-full flex items-center justify-between px-4 py-3 rounded-[16px] transition-all text-left',
                    isSelected
                      ? 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400'
                      : 'hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300'
                  )}
                >
                  <span className="flex items-center gap-2.5 min-w-0">
                    {opt.color && (
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: opt.color }}
                      />
                    )}
                    <span className={cn('text-sm font-bold truncate', isSelected && 'text-purple-600 dark:text-purple-400')}>
                      {opt.label}
                    </span>
                  </span>
                  {isSelected && <Check size={15} className="text-purple-500 shrink-0" />}
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>,
    document.body
  ) : null;

  return (
    <>
      {/* Tasto che apre il modale */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={cn(
          'w-full bg-[#F4F4F4] dark:bg-zinc-900 rounded-[16px] px-4 h-12 flex items-center gap-3 text-sm font-semibold transition-all outline-none focus:ring-4 focus:ring-purple-500/5',
          selected ? 'text-zinc-900 dark:text-zinc-100' : 'text-zinc-400'
        )}
      >
        {triggerIcon || icon}
        <span className="flex-1 text-left truncate">
          {selected ? selected.label : placeholder}
        </span>
        <ChevronRight size={16} className="text-zinc-400 shrink-0" />
      </button>

      {modal}
    </>
  );
};

export default OptionPicker;
