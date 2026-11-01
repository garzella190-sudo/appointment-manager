'use client';

import React from 'react';
import { Car } from 'lucide-react';
import { OptionPicker, PickerOption } from './OptionPicker';

interface VehiclePickerProps {
  options: PickerOption[];
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  title?: string;
  searchPlaceholder?: string;
  emptyLabel?: string;
}

/**
 * Selettore del veicolo (modale in primo piano).
 * Usa `OptionPicker`, la base condivisa con `PatentePicker`.
 */
export const VehiclePicker = ({
  options,
  value,
  onChange,
  placeholder = 'Seleziona veicolo...',
  title = 'Veicolo',
  searchPlaceholder = 'Cerca veicolo...',
  emptyLabel = 'Nessun veicolo disponibile per questa patente e questo cambio',
}: VehiclePickerProps) => (
  <OptionPicker
    options={options}
    value={value}
    onChange={onChange}
    placeholder={placeholder}
    title={title}
    searchPlaceholder={searchPlaceholder}
    emptyLabel={emptyLabel}
    icon={<Car size={18} className="text-purple-500" />}
    triggerIcon={<Car size={16} className="text-zinc-400 shrink-0" />}
  />
);

export default VehiclePicker;
