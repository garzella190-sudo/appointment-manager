'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Trash2, AlertCircle, X, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ConfirmBubbleProps {
  title?: string;
  message?: string;
  onConfirm: () => void;
  onCancel?: () => void;
  trigger: React.ReactNode;
  className?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isLoading?: boolean;
}

export const ConfirmBubble = ({
  title = 'Conferma eliminazione',
  message = 'Sei sicuro? Questa azione non può essere annullata.',
  onConfirm,
  onCancel,
  trigger,
  className,
  confirmLabel = 'Elimina',
  cancelLabel = 'Annulla',
  isLoading = false
}: ConfirmBubbleProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const bubbleRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (bubbleRef.current && !bubbleRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        onCancel?.();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onCancel]);

  return (
    <div className="inline-block">
      <div onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}>
        {trigger}
      </div>

      {isOpen && (
        <div 
          className="fixed inset-0 z-[99999] flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={(e) => {
            e.stopPropagation();
            setIsOpen(false);
            onCancel?.();
          }}
        >
          {/* Backdrop blur - more visible on mobile */}
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          
          <div 
            ref={bubbleRef}
            className={cn(
              "relative w-[90%] max-w-[320px] p-6 bg-white dark:bg-zinc-900 rounded-[32px] shadow-[0_32px_64px_-12px_rgba(0,0,0,0.3)] border border-zinc-100 dark:border-zinc-800 animate-in zoom-in-95 duration-200",
              className
            )}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="space-y-4">
              <div className="flex flex-col items-center text-center gap-3">
                <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-2xl text-red-500 shrink-0 mb-1">
                  <AlertCircle size={32} />
                </div>
                <div>
                  <h4 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 leading-tight">{title}</h4>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-2 leading-relaxed px-1">
                    {message}
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-3 pt-2">
                <button
                  disabled={isLoading}
                  onClick={(e) => {
                    e.stopPropagation();
                    onConfirm();
                    setIsOpen(false);
                  }}
                  className="w-full h-14 rounded-2xl text-sm font-black uppercase tracking-wider bg-red-600 text-white shadow-lg shadow-red-500/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Trash2 size={18} />
                  )}
                  {confirmLabel}
                </button>
                <button
                  disabled={isLoading}
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsOpen(false);
                    onCancel?.();
                  }}
                  className="w-full h-14 rounded-2xl text-sm font-black uppercase tracking-wider text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all border border-zinc-100 dark:border-zinc-800"
                >
                  {cancelLabel}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
