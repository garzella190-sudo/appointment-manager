'use client';

import React, { useState, useEffect } from 'react';
import { Download, Smartphone, Laptop, Apple, Chrome, Share, PlusSquare, X, Check, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

export const InstallPWA = ({ onDismiss }: { onDismiss?: () => void }) => {
  const [platform, setPlatform] = useState<'ios' | 'android' | 'desktop'>('desktop');
  const [activeTab, setActiveTab] = useState<'ios' | 'android' | 'desktop'>('desktop');
  const [isExpanded, setIsExpanded] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(false);

  useEffect(() => {
    const userAgent = window.navigator.userAgent.toLowerCase();
    let detected: 'ios' | 'android' | 'desktop' = 'desktop';
    if (/iphone|ipad|ipod/.test(userAgent)) {
      detected = 'ios';
    } else if (/android/.test(userAgent)) {
      detected = 'android';
    }
    setPlatform(detected);
    setActiveTab(detected);
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
            <h2 className="text-xl font-black text-zinc-900 dark:text-white uppercase tracking-tighter leading-tight">Installa l'App</h2>
            <p className="text-sm text-zinc-500 font-medium">L'agenda sempre a portata di mano</p>
          </div>
        </div>
        {onDismiss && (
          <button onClick={onDismiss} className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors">
            <X size={20} />
          </button>
        )}
      </div>

      <div className="space-y-6">
        {/* Tab Selector */}
        <div className="flex p-1 bg-zinc-100 dark:bg-zinc-800/50 rounded-2xl gap-1">
          {[
            { id: 'ios', icon: Apple, label: 'iOS' },
            { id: 'android', icon: Smartphone, label: 'Android' },
            { id: 'desktop', icon: Laptop, label: 'Computer' }
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id as any);
                  setIsExpanded(true);
                }}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                  isActive 
                    ? "bg-white dark:bg-zinc-800 text-blue-600 dark:text-blue-400 shadow-sm" 
                    : "text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                )}
              >
                <Icon size={14} />
                <span className="hidden xs:inline">{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Dynamic Content */}
        <div className={cn(
          "overflow-hidden transition-all duration-500",
          isExpanded ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0"
        )}>
          <div className="p-6 bg-zinc-50 dark:bg-zinc-800/20 rounded-[24px] border border-zinc-100 dark:border-zinc-800 space-y-6">
            {activeTab === 'ios' && (
              <div className="space-y-5 animate-in fade-in slide-in-from-left-4">
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-xl bg-white dark:bg-zinc-800 shadow-sm flex items-center justify-center text-xs font-black shrink-0 mt-0.5">1</div>
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-zinc-900 dark:text-white">Usa Safari</p>
                    <p className="text-xs text-zinc-500 leading-relaxed">Apri l'agenda in Safari e tocca l'icona <span className="inline-flex items-center px-1.5 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded mx-0.5 text-blue-500"><Share size={12} /> Condividi</span> (quadrato con freccia).</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-xl bg-white dark:bg-zinc-800 shadow-sm flex items-center justify-center text-xs font-black shrink-0 mt-0.5">2</div>
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-zinc-900 dark:text-white">Aggiungi alla Home</p>
                    <p className="text-xs text-zinc-500 leading-relaxed">Scorri il menu e tocca <span className="font-bold text-zinc-700 dark:text-zinc-300">"Aggiungi alla schermata Home"</span>.</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-xl bg-white dark:bg-zinc-800 shadow-sm flex items-center justify-center text-xs font-black shrink-0 mt-0.5">3</div>
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-zinc-900 dark:text-white">Conferma</p>
                    <p className="text-xs text-zinc-500 leading-relaxed">Tocca <span className="font-bold text-zinc-700 dark:text-zinc-300">"Aggiungi"</span> in alto a destra.</p>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'android' && (
              <div className="space-y-5 animate-in fade-in slide-in-from-left-4">
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-xl bg-white dark:bg-zinc-800 shadow-sm flex items-center justify-center text-xs font-black shrink-0 mt-0.5">1</div>
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-zinc-900 dark:text-white">Menu Chrome</p>
                    <p className="text-xs text-zinc-500 leading-relaxed">Tocca i <span className="font-bold text-zinc-700 dark:text-zinc-300">tre puntini</span> (⋮) in alto a destra nel browser.</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-xl bg-white dark:bg-zinc-800 shadow-sm flex items-center justify-center text-xs font-black shrink-0 mt-0.5">2</div>
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-zinc-900 dark:text-white">Installa App</p>
                    <p className="text-xs text-zinc-500 leading-relaxed">Tocca <span className="font-bold text-zinc-700 dark:text-zinc-300">"Installa app"</span> o "Aggiungi a schermata Home".</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-xl bg-white dark:bg-zinc-800 shadow-sm flex items-center justify-center text-xs font-black shrink-0 mt-0.5">3</div>
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-zinc-900 dark:text-white">Conferma</p>
                    <p className="text-xs text-zinc-500 leading-relaxed">Clicca su <span className="font-bold text-zinc-700 dark:text-zinc-300">"Installa"</span> nel popup finale.</p>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'desktop' && (
              <div className="flex items-center gap-5 animate-in fade-in slide-in-from-left-4">
                <div className="w-12 h-12 rounded-2xl bg-white dark:bg-zinc-800 shadow-sm flex items-center justify-center shrink-0">
                  <PlusSquare className="text-blue-500" size={24} />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-bold text-zinc-900 dark:text-white">Installazione Rapida</p>
                  <p className="text-xs text-zinc-500 leading-relaxed">
                    Clicca l'icona di installazione nella barra degli indirizzi di Chrome o Edge (a destra dell'URL).
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Toggle Button for Desktop (initially collapsed) */}
        {!isExpanded && (
          <button 
            onClick={() => setIsExpanded(true)}
            className="w-full flex items-center justify-center gap-2 py-4 border-2 border-dashed border-zinc-100 dark:border-zinc-800 rounded-2xl text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-blue-500 hover:border-blue-500/30 transition-all group"
          >
            Vedi Guida Installazione <ChevronDown size={14} className="group-hover:translate-y-0.5 transition-transform" />
          </button>
        )}

        {isExpanded && (
           <button 
             onClick={() => setIsExpanded(false)}
             className="w-full text-center text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors py-2"
           >
             Chiudi Guida
           </button>
        )}

        <div className="pt-6 border-t border-zinc-100 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="flex items-center gap-4 text-[9px] font-black text-zinc-300 uppercase tracking-widest">
            {platform === 'ios' && <span className="text-blue-500">Stai usando un iPhone/iPad</span>}
            {platform === 'android' && <span className="text-blue-500">Stai usando Android</span>}
            {platform === 'desktop' && <span>Stai usando un Computer</span>}
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
