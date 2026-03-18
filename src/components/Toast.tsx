'use client';

import React, { useEffect, useState } from 'react';
import { CheckCircle, AlertCircle, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ToastType = 'success' | 'error' | 'info';

interface ToastProps {
  message: string;
  type?: ToastType;
  duration?: number;
  onClose: () => void;
}

export const Toast = ({ message, type = 'success', duration = 3000, onClose }: ToastProps) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onClose, 300);
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  return (
    <div className={cn(
      "fixed bottom-40 left-1/2 -translate-x-1/2 z-[200] transition-all duration-300 transform",
      isVisible ? "translate-y-0 opacity-100 scale-100" : "translate-y-4 opacity-0 scale-95"
    )}>
      <div className={cn(
        "flex items-center gap-3 px-6 py-4 rounded-2xl shadow-2xl backdrop-blur-md border",
        type === 'success' ? "bg-emerald-500/90 border-emerald-400 text-white" :
        type === 'error' ? "bg-red-500/90 border-red-400 text-white" :
        "bg-zinc-800/90 border-zinc-700 text-white"
      )}>
        {type === 'success' && <CheckCircle size={20} className="animate-in zoom-in duration-300" />}
        {type === 'error' && <AlertCircle size={20} className="animate-in zoom-in duration-300" />}
        <p className="font-semibold text-sm whitespace-nowrap">{message}</p>
        <button onClick={() => { setIsVisible(false); setTimeout(onClose, 300); }} className="ml-2 hover:opacity-70 p-1">
          <X size={16} />
        </button>
      </div>
    </div>
  );
};
