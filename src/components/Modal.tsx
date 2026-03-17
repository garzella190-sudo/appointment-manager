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
      "fixed inset-0 z-[9999] flex flex-col items-center justify-center p-4 sm:p-6 transition-all duration-300 overflow-y-auto bg-black/40 backdrop-blur-md",
      isOpen ? "opacity-100 visible" : "opacity-0 invisible"
    )}>
      {/* Backdrop overlay trigger - clicks on background empty space close the modal */}
      <div 
        className="fixed inset-0 cursor-pointer"
        onClick={onClose}
        aria-hidden="true"
      />
      
      {/* Modal Panel - Proportional Sizing & Robust Centering */}
      <div 
        className={cn(
          "relative bg-white w-full max-w-[620px] rounded-[32px] shadow-[0_25px_60px_-15px_rgba(0,0,0,0.15)] flex flex-col max-h-[92vh] overflow-hidden transition-all duration-500 transform border border-white my-auto",
          isOpen ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-95 translate-y-8"
        )}
      >
        {/* Header - Identico a Nuovo Appuntamento */}
        <div className="flex items-center justify-between p-8 sm:p-10 pb-4 shrink-0">
          <h2 className="text-[28px] font-black text-zinc-900 tracking-tight leading-none">{title}</h2>
          <button 
            onClick={onClose}
            className="p-3 text-zinc-400 hover:text-zinc-600 bg-zinc-50 hover:bg-zinc-100 rounded-[20px] transition-all hover:rotate-90 appearance-none"
          >
            <X size={24} />
            <span className="sr-only">Chiudi</span>
          </button>
        </div>
        
        {/* Content Container - Scroll interno - Padding aumentato per respiro */}
        <div className="px-8 sm:px-10 pb-10 overflow-y-auto scrollbar-hide">
          {children}
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};
