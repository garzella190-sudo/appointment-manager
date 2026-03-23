'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Search, X, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Option {
  id: string;
  nome: string;
  cognome?: string;
  label?: string; // fallback if nome/cognome not present
  info?: string;
  color?: string;
}

interface SelectProps {
  options: any[]; // generic enough for now, but we'll map them
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  icon?: React.ElementType;
  className?: string;
  searchable?: boolean;
}

const Select = ({ 
  options, 
  value, 
  onChange, 
  placeholder = "Seleziona...", 
  icon: Icon, 
  className,
  searchable = false
}: SelectProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  // Normalize options to a standard format
  const normalizedOptions = options.map(opt => {
    if (typeof opt === 'string') return { id: opt, label: opt };
    const label = opt.label || (opt.nome && opt.cognome ? `${opt.cognome} ${opt.nome}` : opt.nome || opt.tipo || opt.id);
    return { ...opt, label };
  });

  const selectedOption = normalizedOptions.find(opt => opt.id === value);

  const filteredOptions = !searchable || query.trim() === ''
    ? normalizedOptions
    : normalizedOptions.filter(opt => opt.label.toLowerCase().includes(query.toLowerCase()));

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (val: string) => {
    onChange(val);
    setIsOpen(false);
    setQuery('');
  };

  return (
    <div className={cn("relative w-full", className)} ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-full bg-[#F4F4F4] dark:bg-zinc-900 border-transparent rounded-[16px] px-4 flex items-center h-12 text-sm font-semibold transition-all outline-none focus:ring-4 focus:ring-blue-500/5",
          isOpen ? "border-blue-400 ring-4 ring-blue-500/5" : "",
          selectedOption ? "text-zinc-900 dark:text-zinc-100" : "text-zinc-400"
        )}
      >
        {Icon && <Icon size={16} className="mr-3 text-zinc-400 shrink-0" />}
        <span className="flex-1 text-left truncate">
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown 
          size={16} 
          className={cn("ml-2 text-zinc-400 transition-transform duration-200", isOpen ? "rotate-180" : "")} 
        />
      </button>

      {isOpen && (
        <div className="absolute z-50 w-full mt-2 bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-[20px] shadow-2xl shadow-black/5 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
          {searchable && (
            <div className="p-2 border-b border-zinc-50 dark:border-zinc-800">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input
                  autoFocus
                  type="text"
                  className="w-full bg-zinc-50 dark:bg-zinc-800/50 border-none rounded-xl pl-9 pr-4 py-2 text-xs font-semibold outline-none focus:ring-2 focus:ring-blue-500/10"
                  placeholder="Cerca..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
            </div>
          )}
          
          <div className="max-h-[240px] overflow-y-auto p-2">
            {filteredOptions.length === 0 ? (
              <p className="p-4 text-center text-xs text-zinc-400 italic">Nessun risultato</p>
            ) : (
              filteredOptions.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => handleSelect(opt.id)}
                  className={cn(
                    "w-full text-left px-3 py-2.5 rounded-xl transition-all flex items-center justify-between group",
                    value === opt.id 
                      ? "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400" 
                      : "hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
                  )}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {opt.color && (
                      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: opt.color }} />
                    )}
                    <div className="truncate">
                      <p className="text-sm font-bold truncate">{opt.label}</p>
                      {opt.info && <p className="text-[10px] opacity-60 truncate">{opt.info}</p>}
                    </div>
                  </div>
                  {value === opt.id && <Check size={14} className="shrink-0" />}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Select;
