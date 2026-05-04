'use client';

import React, { useState, useEffect } from 'react';
import { Download, Smartphone, Laptop, Apple, Chrome, Share, PlusSquare, X, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export const InstallPWA = ({ onDismiss }: { onDismiss?: () => void }) => {
  const [platform, setPlatform] = useState<'ios' | 'android' | 'desktop'>('desktop');
  const [dontShowAgain, setDontShowAgain] = useState(false);

  useEffect(() => {
    const userAgent = window.navigator.userAgent.toLowerCase();
    if (/iphone|ipad|ipod/.test(userAgent)) {
      setPlatform('ios');
    } else if (/android/.test(userAgent)) {
      setPlatform('android');
    } else {
      setPlatform('desktop');
    }
  }, []);

  const handleDontShowAgain = () => {
    const newVal = !dontShowAgain;
    setDontShowAgain(newVal);
    if (newVal) {
      localStorage.setItem('pwa_prompt_dismissed', 'true');
    } else {
      localStorage.removeItem('pwa_prompt_dismissed');
    }
  };

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[32px] p-6 sm:p-8 shadow-sm">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-100 dark:bg-blue-900/20 text-blue-600 flex items-center justify-center">
            <Download size={24} />
          </div>
          <div>
            <h2 className="text-xl font-black text-zinc-900 dark:text-white uppercase tracking-tighter">Installa l'App</h2>
            <p className="text-sm text-zinc-500 font-medium">L'agenda sempre a portata di mano</p>
          </div>
        </div>
        {onDismiss && (
          <button onClick={onDismiss} className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors">
            <X size={20} />
          </button>
        )}
      </div>

      <div className="space-y-8">
        {platform === 'ios' ? (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-xs font-black shrink-0 mt-0.5">1</div>
              <div className="space-y-1">
                <p className="text-sm font-bold text-zinc-900 dark:text-white">Apri in Safari</p>
                <p className="text-xs text-zinc-500 leading-relaxed">Assicurati di usare Safari. Tocca l'icona <span className="inline-flex items-center px-1.5 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded mx-0.5 text-blue-500"><Share size={12} /> Condividi</span> (il quadrato con la freccia in su).</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-xs font-black shrink-0 mt-0.5">2</div>
              <div className="space-y-1">
                <p className="text-sm font-bold text-zinc-900 dark:text-white">Aggiungi alla Home</p>
                <p className="text-xs text-zinc-500 leading-relaxed">Scorri verso il basso nel menu che appare e tocca <span className="font-bold text-zinc-700 dark:text-zinc-300">"Aggiungi alla schermata Home"</span>.</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-xs font-black shrink-0 mt-0.5">3</div>
              <div className="space-y-1">
                <p className="text-sm font-bold text-zinc-900 dark:text-white">Conferma</p>
                <p className="text-xs text-zinc-500 leading-relaxed">Tocca <span className="font-bold text-zinc-700 dark:text-zinc-300">"Aggiungi"</span> nell'angolo in alto a destra per completare l'installazione.</p>
              </div>
            </div>
          </div>
        ) : platform === 'android' ? (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-xs font-black shrink-0 mt-0.5">1</div>
              <div className="space-y-1">
                <p className="text-sm font-bold text-zinc-900 dark:text-white">Menu Browser</p>
                <p className="text-xs text-zinc-500 leading-relaxed">Tocca i <span className="font-bold text-zinc-700 dark:text-zinc-300">tre puntini</span> (⋮) in alto a destra o in basso nel tuo browser (Chrome).</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-xs font-black shrink-0 mt-0.5">2</div>
              <div className="space-y-1">
                <p className="text-sm font-bold text-zinc-900 dark:text-white">Installa App</p>
                <p className="text-xs text-zinc-500 leading-relaxed">Tocca la voce <span className="font-bold text-zinc-700 dark:text-zinc-300">"Installa app"</span> o "Aggiungi a schermata Home".</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-xs font-black shrink-0 mt-0.5">3</div>
              <div className="space-y-1">
                <p className="text-sm font-bold text-zinc-900 dark:text-white">Conferma</p>
                <p className="text-xs text-zinc-500 leading-relaxed">Conferma cliccando su <span className="font-bold text-zinc-700 dark:text-zinc-300">"Installa"</span> nel popup che appare.</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
            <div className="p-6 bg-zinc-50 dark:bg-zinc-800/50 rounded-[24px] border border-zinc-100 dark:border-zinc-800 flex items-center gap-5">
              <Laptop className="text-blue-500 shrink-0" size={32} />
              <div className="space-y-1">
                <p className="text-sm font-bold text-zinc-900 dark:text-white">Installazione su Computer</p>
                <p className="text-xs text-zinc-500 leading-relaxed">
                  Clicca sull'icona di installazione (piccolo computer con freccia) nella barra degli indirizzi di Chrome o Edge.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="pt-6 border-t border-zinc-100 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 text-[10px] font-black text-zinc-400 uppercase tracking-widest">
              <Apple size={14} className="text-zinc-300" /> iOS
            </div>
            <div className="flex items-center gap-2 text-[10px] font-black text-zinc-400 uppercase tracking-widest">
              <Smartphone size={14} className="text-zinc-300" /> Android
            </div>
          </div>

          {onDismiss && (
            <button 
              onClick={handleDontShowAgain}
              className="flex items-center gap-2 group cursor-pointer"
            >
              <div className={cn(
                "w-5 h-5 rounded-lg border-2 transition-all flex items-center justify-center",
                dontShowAgain 
                  ? "bg-blue-500 border-blue-500 text-white" 
                  : "border-zinc-200 dark:border-zinc-700 group-hover:border-blue-400"
              )}>
                {dontShowAgain && <Check size={12} strokeWidth={4} />}
              </div>
              <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400 group-hover:text-zinc-700 dark:group-hover:text-zinc-200 transition-colors">Non mostrare più</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
