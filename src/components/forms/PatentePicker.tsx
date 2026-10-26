'use client';

import React, { useState, useEffect, useRef } from 'react';
import { BadgeCheck, ChevronRight, Search, Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { createPortal } from 'react-dom';

interface PatenteOption {
  id: string;
  label: string;
}

interface PatentePickerProps {
  options: PatenteOption[];
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
}

export const PatentePicker = ({
  options,
  value,
  onChange,
  placeholder = 'Seleziona Patente',
}: PatentePickerProps) => {
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

  // Close on backdrop click / Escape
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen]);

  const modal = isOpen && mounted ? createPortal(
    <div
      className="fixed inset-0 z-[99999] flex items-end sm:items-center justify-center p-4"
      onClick={handleClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />

      {/* Card */}
      <div
        className="relative z-10 w-full max-w-sm bg-white dark:bg-zinc-900 rounded-[32px] shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <div className="flex items-center gap-2">
            <BadgeCheck size={18} className="text-purple-500" />
            <span className="font-bold text-sm text-zinc-800 dark:text-zinc-100 uppercase tracking-widest">
              Patente Richiesta
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

        {/* Search */}
        <div className="px-4 pb-2">
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
            <input
              ref={searchRef}
              type="text"
              inputMode={searchActive ? 'text' : 'none'}
              readOnly={!searchActive}
              className="w-full bg-[#F4F4F4] dark:bg-zinc-800 rounded-[14px] pl-8 pr-4 py-2.5 text-sm font-semibold outline-none focus:ring-2 focus:ring-purple-500/20 transition-all cursor-pointer"
              placeholder="Cerca patente..."
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

        {/* Options list */}
        <div className="max-h-[260px] overflow-y-auto px-3 pb-4 space-y-0.5">
          {filtered.length === 0 ? (
            <p className="py-6 text-center text-xs text-zinc-400 italic">Nessun risultato</p>
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
                  <span className={cn('text-sm font-bold', isSelected && 'text-purple-600 dark:text-purple-400')}>
                    {opt.label}
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
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={cn(
          'w-full bg-[#F4F4F4] dark:bg-zinc-900 rounded-[16px] px-4 h-12 flex items-center gap-3 text-sm font-semibold transition-all outline-none focus:ring-4 focus:ring-purple-500/5',
          selected ? 'text-zinc-900 dark:text-zinc-100' : 'text-zinc-400'
        )}
      >
        <BadgeCheck size={16} className="text-zinc-400 shrink-0" />
        <span className="flex-1 text-left truncate">
          {selected ? selected.label : placeholder}
        </span>
        <ChevronRight size={16} className="text-zinc-400 shrink-0" />
      </button>

      {modal}
    </>
  );
};

export default PatentePicker;
