'use client';

import React, { useEffect, useState } from 'react';
import { Users } from 'lucide-react';
import { createPortal } from 'react-dom';

interface ConfirmMultiInstructorModalProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  title?: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
}

export function ConfirmMultiInstructorModal({
  isOpen,
  onConfirm,
  onCancel,
  title = "Visualizza Più Istruttori",
  message = "Sei sicuro di voler visualizzare il calendario di più istruttori contemporaneamente?",
  confirmLabel = "CONFERMA",
  cancelLabel = "ANNULLA"
}: ConfirmMultiInstructorModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || !isOpen) return null;

  return createPortal(
    <div 
      className="fixed inset-0 z-[10000] flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={onCancel}
    >
      {/* Backdrop blur */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      
      <div 
        className="relative w-[90%] max-w-[340px] p-6 bg-white dark:bg-zinc-900 rounded-[32px] shadow-[0_32px_64px_-12px_rgba(0,0,0,0.3)] border border-zinc-100 dark:border-zinc-800 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="space-y-4">
          <div className="flex flex-col items-center text-center gap-3">
            <div className="p-4 bg-sky-50 dark:bg-sky-900/20 rounded-2xl text-sky-600 dark:text-sky-400 shrink-0 mb-1">
              <Users size={32} />
            </div>
            <div>
              <h4 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 leading-tight">
                {title}
              </h4>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-2 leading-relaxed px-1">
                {message}
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-3 pt-2">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onConfirm();
              }}
              className="w-full h-14 rounded-2xl text-sm font-black uppercase tracking-wider bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Users size={18} />
              {confirmLabel}
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onCancel();
              }}
              className="w-full h-14 rounded-2xl text-sm font-black uppercase tracking-wider text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all border border-zinc-100 dark:border-zinc-800 cursor-pointer"
            >
              {cancelLabel}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
