'use client';

import React from 'react';
import { Phone, MessageCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PhoneActionsProps {
  phone: string;
  className?: string;
  secondary?: boolean;
}

export const PhoneActions = ({ phone, className, secondary = false }: PhoneActionsProps) => {
  if (!phone) return null;

  const cleanPhone = phone.replace(/\D/g, '');
  const waPhone = cleanPhone.startsWith('39') ? cleanPhone : `39${cleanPhone}`;
  
  const iconSize = secondary ? 12 : 14;

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <a
        href={`tel:${cleanPhone}`}
        className={cn(
          "flex items-center gap-1.5 transition-all font-semibold",
          secondary 
            ? "px-2 py-1 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 rounded-lg text-[10px] hover:bg-green-100 dark:hover:bg-green-800/40"
            : "p-2 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 rounded-xl hover:bg-green-100 dark:hover:bg-green-800/40"
        )}
        title="Chiama"
      >
        <Phone size={iconSize} />
        {secondary && <span>Chiama</span>}
      </a>
      <a
        href={`https://wa.me/${waPhone}`}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          "flex items-center gap-1.5 transition-all font-semibold",
          secondary
            ? "px-2 py-1 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-lg text-[10px] hover:bg-emerald-100 dark:hover:bg-emerald-800/40"
            : "p-2 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-xl hover:bg-emerald-100 dark:hover:bg-emerald-800/40"
        )}
        title="WhatsApp"
      >
        <MessageCircle size={iconSize} />
        {secondary && <span>WhatsApp</span>}
      </a>
    </div>
  );
};
