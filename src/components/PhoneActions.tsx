'use client';

import React from 'react';
import { Phone, MessageCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { WhatsAppButton } from './WhatsAppButton';

interface PhoneActionsProps {
  phone: string;
  className?: string;
  secondary?: boolean;
  appointmentData?: {
    date: string;
    time: string;
    duration: number;
  };
}

export const PhoneActions = ({ 
  phone, 
  className, 
  secondary = false,
  appointmentData
}: PhoneActionsProps) => {
  if (!phone) return null;

  const cleanPhone = phone.replace(/\D/g, '');
  const waPhone = cleanPhone.startsWith('39') ? cleanPhone : `39${cleanPhone}`;
  
  const iconSize = secondary ? 12 : 14;

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <WhatsAppButton 
        phone={phone} 
        label={secondary ? "WhatsApp" : ""} 
        showLabel={secondary}
        variant={secondary ? 'ghost' : 'primary'}
        appointmentData={appointmentData}
        className={cn(
          "rounded-xl overflow-hidden",
          secondary 
            ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 text-[10px]"
            : "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400"
        )}
      />
    </div>
  );
};
