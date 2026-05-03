'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Calendar, Home, UserCircle, PlusCircle, Wrench, User, LogOut, GraduationCap, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Modal } from './Modal';
import { AppointmentForm } from './forms/AppointmentForm';
import { ConfirmBubble } from './ConfirmBubble';
import { PushSubscriptionButton } from './PushSubscriptionButton';
import { signOutAction } from '@/actions/auth';
import { useAuth } from '@/hooks/useAuth';

const BottomNav = () => {
  const { user, role, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPermissionsModalOpen, setIsPermissionsModalOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  if (pathname === '/login') {
    return null;
  }

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await signOutAction();
    } catch {
      // redirect() in Next.js throws internally — this is expected
      window.location.href = '/login';
    }
  };

  const getPermissions = () => {
    if (role === 'AdminDev') return [
      'Accesso Totale al Sistema (Dev)',
      'Manutenzione Database & Logs',
      'Gestione Staff e Veicoli',
      'Configurazione Patenti',
      'Report Finanziari e Plus',
      'Gestione Utenti e Permessi'
    ];
    if (role === 'admin') return [
      'Accesso Totale al Sistema',
      'Gestione Staff e Veicoli',
      'Configurazione Patenti',
      'Report Finanziari e Plus',
      'Gestione Utenti e Permessi'
    ];
    if (role === 'segreteria') return [
      'Gestione Appuntamenti',
      'Anagrafica Clienti',
      'Visualizzazione Esami',
      'Report Plus'
    ];
    return [
      'Visualizzazione propria Agenda',
      'Note Guide in tempo reale',
      'Stato "Pronto Esame"',
      'Dettagli Allievi assegnati'
    ];
  };

  const navLeft = [
    { name: 'Home',      href: '/',         icon: Home },
    { name: 'Calendario', href: '/calendar', icon: Calendar },
  ];

  const navRight = [
    { name: 'Clienti',  href: '/clienti',  icon: UserCircle },
    { name: 'Esami',     href: '/esami',    icon: GraduationCap },
    { name: 'Gestione', href: '/gestione', icon: Wrench },
  ];

  return (
    <>
      <nav className="fixed bottom-[calc(1.5rem+env(safe-area-inset-bottom,0px))] left-1/2 -translate-x-1/2 w-[96%] max-w-[96vw] md:max-w-2xl z-50 flex justify-center items-end pointer-events-none print:hidden">
        
        {/* Left Segment */}
        <div className="flex-1 min-w-0 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-xl flex items-center justify-between py-2 px-2 sm:px-5 rounded-[24px] sm:rounded-[28px] shadow-xl dark:shadow-2xl border border-zinc-200/50 dark:border-zinc-800/50 mr-1 sm:mr-2 pointer-events-auto transition-all">
          <button 
            onClick={() => setIsPermissionsModalOpen(true)}
            className="flex items-center gap-2 shrink-0 hover:bg-zinc-100 dark:hover:bg-zinc-800 p-1 sm:p-1.5 rounded-[16px] sm:rounded-[20px] transition-all active:scale-95 text-left border-none outline-none"
          >
            <div className={cn(
              "w-8 h-8 sm:w-9 sm:h-9 rounded-[12px] sm:rounded-[14px] flex items-center justify-center shrink-0 shadow-inner",
              role === 'AdminDev' ? "bg-gradient-to-tr from-zinc-800 to-zinc-900 text-amber-400" :
              role === 'admin' ? "bg-gradient-to-tr from-amber-100 to-amber-200 text-amber-600" : 
              "bg-gradient-to-tr from-sky-100 to-sky-200 text-sky-600"
            )}>
              {role === 'AdminDev' ? <ShieldCheck size={16} strokeWidth={2.5} /> :
               role === 'admin' ? <ShieldCheck size={16} strokeWidth={2.5} /> : <User size={16} strokeWidth={2.5} />}
            </div>
            <div className="hidden lg:flex flex-col min-w-0">
              <span className="text-[10px] font-black text-zinc-900 dark:text-zinc-100 truncate">
                {user?.user_metadata?.full_name?.split(' ')[0] || user?.email?.split('@')[0] || 'Utente'}
              </span>
              {role && (
                <span className="text-[8px] font-black tracking-widest text-zinc-400 leading-none uppercase">
                  {role}
                </span>
              )}
            </div>
          </button>
          
          <div className="flex items-center gap-1 sm:gap-4 overflow-hidden">
            {navLeft.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  title={item.name}
                  onClick={() => {
                    if (item.name === 'Calendario') {
                      localStorage.setItem('calendar_currentDate', new Date().toISOString());
                      window.dispatchEvent(new CustomEvent('calendar-reset-today'));
                    } else if (item.name === 'Home') {
                      window.dispatchEvent(new CustomEvent('home-reset-today'));
                    }
                  }}
                  className={cn(
                    "relative flex flex-col items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-[16px] sm:rounded-[20px] transition-all duration-300 active:scale-95 group shrink-0",
                    isActive ? "bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400" : "text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                  )}
                >
                  <Icon size={18} strokeWidth={isActive ? 2.5 : 2} className={cn(
                    "transition-transform duration-300 sm:w-[20px] sm:h-[20px]",
                    isActive ? "scale-110" : "group-hover:scale-110"
                  )} />
                </Link>
              );
            })}
          </div>
        </div>

        {/* Center Indented Button */}
        <div className="shrink-0 pointer-events-auto relative z-10 flex items-center justify-center mb-1">
          <div className="absolute inset-0 bg-gradient-to-tr from-sky-400 to-sky-600 rounded-[22px] blur-md opacity-40 dark:opacity-60 scale-90 translate-y-1"></div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="relative bg-gradient-to-tr from-sky-400 to-sky-600 text-white w-12 h-12 sm:w-14 sm:h-14 rounded-[18px] sm:rounded-[22px] shadow-xl transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer outline-none ring-offset-2 dark:ring-offset-zinc-950 focus:ring-2 focus:ring-sky-500 flex items-center justify-center border border-white/20"
          >
            <PlusCircle size={24} strokeWidth={2.5} className="sm:w-[26px] sm:h-[26px]" />
          </button>
        </div>

        {/* Right Segment */}
        <div className="flex-1 min-w-0 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-xl flex items-center justify-between py-2 px-2 sm:px-5 rounded-[24px] sm:rounded-[28px] shadow-xl dark:shadow-2xl border border-zinc-200/50 dark:border-zinc-800/50 ml-1 sm:ml-2 pointer-events-auto transition-all">
          <div className="flex items-center gap-1 sm:gap-4 w-full justify-between sm:justify-end overflow-hidden">
            {navRight.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  title={item.name}
                  className={cn(
                    "relative flex flex-col items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-[16px] sm:rounded-[20px] transition-all duration-300 active:scale-95 group shrink-0",
                    isActive ? "bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400" : "text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                  )}
                >
                  <Icon size={18} strokeWidth={isActive ? 2.5 : 2} className={cn(
                    "transition-transform duration-300 sm:w-[20px] sm:h-[20px]",
                    isActive ? "scale-110" : "group-hover:scale-110"
                  )} />
                </Link>
              );
            })}
          </div>
        </div>

      </nav>

      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title="Nuovo Appuntamento"
      >
        <AppointmentForm 
          onSuccess={() => {
            setIsModalOpen(false);
            router.refresh(); 
            // Trigger automatic sync for client components
            window.dispatchEvent(new CustomEvent('appointments-updated'));
          }} 
          onCancel={() => setIsModalOpen(false)} 
        />
      </Modal>

      <Modal
        isOpen={isPermissionsModalOpen}
        onClose={() => setIsPermissionsModalOpen(false)}
        title="I tuoi Permessi"
      >
        <div className="space-y-6">
          <div className="flex items-center gap-4 p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-[24px] border border-zinc-100 dark:border-zinc-800">
            <div className={cn(
              "w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg",
              role === 'AdminDev' ? "bg-zinc-900 text-white" :
              role === 'admin' ? "bg-amber-100 text-amber-600" : "bg-sky-100 text-sky-600"
            )}>
               {role === 'AdminDev' ? <ShieldCheck size={28} className="text-amber-400" /> :
                role === 'admin' ? <ShieldCheck size={28} /> : <User size={28} />}
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Ruolo Attuale</p>
              <h3 className="text-xl font-black uppercase text-zinc-900 dark:text-white items-center gap-2 flex">
                {role}
              </h3>
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 ml-1">Cosa puoi fare:</p>
            <div className="grid gap-2">
              {getPermissions().map((perm, i) => (
                <div key={i} className="flex items-center gap-3 p-3 bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-2xl shadow-sm">
                  <div className="w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                    <CheckCircle2 size={14} strokeWidth={3} />
                  </div>
                  <span className="text-sm font-bold text-zinc-700 dark:text-zinc-200">{perm}</span>
                </div>
              ))}
            </div>
          </div>
          
          <div className="space-y-3">
             <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 ml-1">Impostazioni Dispositivo</p>
             <PushSubscriptionButton />
          </div>

          <div className="flex gap-4">
            <button
              onClick={() => setIsPermissionsModalOpen(false)}
              className="flex-1 h-14 bg-zinc-900 text-white rounded-[24px] font-black text-xs uppercase tracking-widest hover:bg-zinc-800 transition-all active:scale-95 shadow-lg shadow-zinc-500/20"
            >
              Ricevuto
            </button>
            <ConfirmBubble
              title="Esci dall'app"
              message="Vuoi terminare la sessione attuale?"
              confirmLabel="Esci"
              onConfirm={handleLogout}
              trigger={
                <button
                  disabled={isLoggingOut}
                  className="flex-1 h-14 bg-red-50 text-red-600 rounded-[24px] font-black text-xs uppercase tracking-widest hover:bg-red-100 transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <LogOut size={16} /> Esci
                </button>
              }
            />
          </div>
        </div>
      </Modal>
    </>
  );
};

export default BottomNav;
