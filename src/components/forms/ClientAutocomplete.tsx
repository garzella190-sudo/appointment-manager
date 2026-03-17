'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Search, User, X } from 'lucide-react';
import { Cliente } from '@/lib/database.types';
import { cn } from '@/lib/utils';

interface ClientAutocompleteProps {
  clients: Cliente[];
  onSelect: (client: Cliente) => void;
  defaultValue?: Cliente | null;
  placeholder?: string;
  className?: string;
}

export const ClientAutocomplete = ({
  clients,
  onSelect,
  defaultValue,
  placeholder = "Cerca cliente...",
  className
}: ClientAutocompleteProps) => {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Cliente | null>(defaultValue || null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (defaultValue) {
      setSelectedClient(defaultValue);
      setQuery(`${defaultValue.cognome} ${defaultValue.nome}`);
    }
  }, [defaultValue]);

  const filteredClients = query.trim() === ''
    ? []
    : clients.filter((client) => {
        const full = `${client.nome} ${client.cognome}`.toLowerCase();
        const reverse = `${client.cognome} ${client.nome}`.toLowerCase();
        const search = query.toLowerCase();
        return full.includes(search) || reverse.includes(search);
      }).slice(0, 8);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (client: Cliente) => {
    setSelectedClient(client);
    setQuery(`${client.cognome} ${client.nome}`);
    setIsOpen(false);
    onSelect(client);
  };

  const handleClear = () => {
    setSelectedClient(null);
    setQuery('');
    setIsOpen(true);
  };

  return (
    <div className={cn("relative w-full", className)} ref={containerRef}>
      <div className="relative">
        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400">
          <Search size={18} />
        </div>
        <input
          type="text"
          className="w-full bg-[#F4F4F4] border-transparent rounded-[16px] pl-12 pr-10 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all text-sm h-12 font-semibold text-zinc-900"
          placeholder={placeholder}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
            if (selectedClient) setSelectedClient(null);
          }}
          onFocus={() => setIsOpen(true)}
        />
        {query && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 transition-colors"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {isOpen && filteredClients.length > 0 && (
        <div className="absolute z-50 w-full mt-2 bg-white border border-zinc-100 rounded-[20px] shadow-2xl shadow-black/5 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="max-h-[300px] overflow-y-auto p-2">
            {filteredClients.map((client) => (
              <button
                key={client.id}
                type="button"
                onClick={() => handleSelect(client)}
                className="w-full flex items-center gap-3 p-3 hover:bg-blue-50/50 rounded-[12px] transition-all group"
              >
                <div className="w-10 h-10 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-500 group-hover:bg-blue-100 group-hover:text-blue-600 transition-colors">
                  <User size={18} />
                </div>
                <div className="text-left">
                  <p className="text-sm font-bold text-zinc-900">{client.cognome} {client.nome}</p>
                  {client.telefono && <p className="text-[10px] text-zinc-400 font-medium">{client.telefono}</p>}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {isOpen && query.trim() !== '' && filteredClients.length === 0 && (
        <div className="absolute z-50 w-full mt-2 bg-white border border-zinc-100 rounded-[20px] shadow-2xl shadow-black/5 p-6 text-center animate-in fade-in slide-in-from-top-2 duration-200">
          <p className="text-sm text-zinc-400 font-medium">Nessun cliente trovato</p>
        </div>
      )}
    </div>
  );
};
