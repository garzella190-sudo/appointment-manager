'use client';

import React from 'react';
import { User } from 'lucide-react';
import { OptionPicker, PickerOption } from './OptionPicker';

interface IstruttorePickerProps {
  options: PickerOption[];
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  title?: string;
  searchPlaceholder?: string;
  emptyLabel?: string;
}

/**
 * Selettore dell'istruttore (modale in primo piano, sempre centrato).
 * Usa `OptionPicker`, la base condivisa con `PatentePicker` e `VehiclePicker`:
 * stesso comportamento, stessa ricerca, stesso stile. Gli istruttori occupati
 * arrivano come opzioni `disabled` con `info: 'Occupato'`.
 */
export const IstruttorePicker = ({
  options,
  value,
  onChange,
  placeholder = 'Seleziona istruttore...',
  title = 'Istruttore',
  searchPlaceholder = 'Cerca istruttore...',
  emptyLabel = 'Nessun istruttore disponibile',
}: IstruttorePickerProps) => (
  <OptionPicker
    options={options}
    value={value}
    onChange={onChange}
    placeholder={placeholder}
    title={title}
    searchPlaceholder={searchPlaceholder}
    emptyLabel={emptyLabel}
    icon={<User size={18} className="text-purple-500" />}
    triggerIcon={<User size={16} className="text-zinc-400 shrink-0" />}
  />
);

export default IstruttorePicker;
