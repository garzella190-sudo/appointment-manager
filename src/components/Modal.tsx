'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export const Modal = ({ isOpen, onClose, title, children }: ModalProps) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!mounted) return null;

  const modalContent = (
    <div className={cn(
      "fixed inset-0 z-[9999] grid place-items-center p-4 sm:p-6 transition-all duration-300 overflow-y-auto",
      isOpen ? "opacity-100 visible" : "opacity-0 invisible"
    )}>
      {/* Backdrop overlay glassmorphism */}
      <div 
        className={cn(
          "fixed inset-0 bg-black/40 backdrop-blur-md transition-opacity duration-300",
          isOpen ? "opacity-100" : "opacity-0"
        )}
        onClick={onClose}
        aria-hidden="true"
      />
      
      {/* Modal Panel - Proportional Sizing & Centered */}
      <div 
        className={cn(
          "relative bg-white dark:bg-zinc-900 w-full max-w-xl rounded-[32px] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden transition-all duration-500 transform border border-white/20 dark:border-zinc-800 my-auto",
          isOpen ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-95 translate-y-8"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 sm:p-7 border-b border-zinc-100 dark:border-zinc-800 shrink-0">
          <h2 className="text-2xl font-black text-zinc-900 dark:text-zinc-50 tracking-tight">{title}</h2>
          <button 
            onClick={onClose}
            className="p-2.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 bg-zinc-50 hover:bg-zinc-100 dark:bg-zinc-800/50 dark:hover:bg-zinc-800 rounded-2xl transition-all hover:rotate-90"
          >
            <X size={22} />
            <span className="sr-only">Chiudi</span>
          </button>
        </div>
        
        {/* Content Container - Scroll interno */}
        <div className="p-6 sm:p-7 overflow-y-auto scrollbar-hide">
          {children}
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};
