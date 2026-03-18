'use client';

import React, { useState, useEffect } from 'react';
import { Download, Smartphone, Laptop, Apple, Chrome, Share, PlusSquare } from 'lucide-react';
import { cn } from '@/lib/utils';

export const InstallPWA = () => {
  const [platform, setPlatform] = useState<'ios' | 'android' | 'desktop'>('desktop');

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

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[32px] p-8 shadow-sm">
      <div className="flex items-center gap-4 mb-6">
        <div className="w-12 h-12 rounded-2xl bg-blue-100 dark:bg-blue-900/20 text-blue-600 flex items-center justify-center">
          <Download size={24} />
        </div>
        <div>
          <h2 className="text-xl font-bold text-zinc-900 dark:text-white">Installa l'App</h2>
          <p className="text-sm text-zinc-500">Porta Appointment Manager sempre con te</p>
        </div>
      </div>

      <div className="space-y-6">
        {platform === 'ios' ? (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">1</div>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Tocca l'icona <span className="inline-flex items-center px-1.5 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded mx-1 text-blue-500"><Share size={14} /> Condividi</span> in basso o in alto nel browser.
              </p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">2</div>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Scorri verso il basso e seleziona <span className="font-bold text-zinc-900 dark:text-white">"Aggiungi alla schermata Home"</span>.
              </p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">3</div>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Tocca <span className="font-bold text-zinc-900 dark:text-white">"Aggiungi"</span> nell'angolo in alto a destra.
              </p>
            </div>
          </div>
        ) : platform === 'android' ? (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">1</div>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Tocca i <span className="font-bold text-zinc-900 dark:text-white">tre puntini</span> in alto a destra nel browser.
              </p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">2</div>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Seleziona <span className="font-bold text-zinc-900 dark:text-white">"Installa app"</span> o "Aggiungi a schermata Home".
              </p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">3</div>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Conferma cliccando su <span className="font-bold text-zinc-900 dark:text-white">"Installa"</span>.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
            <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl flex items-center gap-4">
              <Laptop className="text-zinc-400" size={24} />
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Puoi installare l'app anche su computer cliccando sull'icona di installazione nella barra degli indirizzi di Chrome o Edge.
              </p>
            </div>
          </div>
        )}

        <div className="pt-6 border-t border-zinc-100 dark:border-zinc-800 flex flex-wrap gap-6">
          <div className="flex items-center gap-2 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
            <Apple size={14} /> Disponibile su iOS
          </div>
          <div className="flex items-center gap-2 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
            <Smartphone size={14} /> Disponibile su Android
          </div>
        </div>
      </div>
    </div>
  );
};
