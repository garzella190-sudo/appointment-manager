'use client';

import React from 'react';
import { BadgeCheck } from 'lucide-react';
import { OptionPicker, PickerOption } from './OptionPicker';

interface PatentePickerProps {
  options: PickerOption[];
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  title?: string;
  searchPlaceholder?: string;
  emptyLabel?: string;
}

/**
 * Selettore della patente richiesta (modale in primo piano).
 * Usa `OptionPicker`, la base condivisa con `VehiclePicker`.
 */
export const PatentePicker = ({
  options,
  value,
  onChange,
  placeholder = 'Seleziona Patente',
  title = 'Patente Richiesta',
  searchPlaceholder = 'Cerca patente...',
  emptyLabel = 'Nessun risultato',
}: PatentePickerProps) => (
  <OptionPicker
    options={options}
    value={value}
    onChange={onChange}
    placeholder={placeholder}
    title={title}
    searchPlaceholder={searchPlaceholder}
    emptyLabel={emptyLabel}
    icon={<BadgeCheck size={18} className="text-purple-500" />}
    triggerIcon={<BadgeCheck size={16} className="text-zinc-400 shrink-0" />}
  />
);

export default PatentePicker;
