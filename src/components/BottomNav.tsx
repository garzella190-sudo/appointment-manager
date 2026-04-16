'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Calendar, Home, UserCircle, PlusCircle, Wrench, User, LogOut, GraduationCap, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Modal } from './Modal';
import { AppointmentForm } from './forms/AppointmentForm';
import { ConfirmBubble } from './ConfirmBubble';
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
      <nav className="fixed bottom-[calc(1.5rem+env(safe-area-inset-bottom,0px))] left-1/2 -translate-x-1/2 w-[98%] max-w-2xl z-50 animate-in fade-in slide-in-from-bottom-4 duration-500 print:hidden">
        <div className="bg-white/90 dark:bg-zinc-900/90 backdrop-blur-xl grid grid-cols-[1fr_auto_1fr] items-center py-2 px-4 sm:px-6 rounded-[32px] shadow-[0_20px_50px_rgba(0,0,0,0.1)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.3)] border border-zinc-200/50 dark:border-zinc-800/50">
          
          {/* Left: Profile + NavLeft */}
          <div className="flex items-center gap-2 sm:gap-4 overflow-hidden">
            <button 
              onClick={() => setIsPermissionsModalOpen(true)}
              className="flex items-center gap-2 shrink-0 hover:bg-zinc-100 dark:hover:bg-zinc-800 p-1 rounded-2xl transition-all active:scale-95 text-left border-none outline-none"
            >
              <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-inner",
                role === 'admin' ? "bg-amber-100 text-amber-600" : "bg-sky-100 text-sky-600"
              )}>
                {role === 'admin' ? <ShieldCheck size={16} strokeWidth={2.5} /> : <User size={16} strokeWidth={2.5} />}
              </div>
              <div className="hidden lg:flex flex-col min-w-0">
                <span className="text-[10px] font-bold text-zinc-900 dark:text-zinc-100 truncate">
                  {user?.user_metadata?.full_name?.split(' ')[0] || user?.email?.split('@')[0] || 'Utente'}
                </span>
                {role && (
                  <span className="text-[8px] font-black uppercase tracking-tighter text-zinc-400 leading-none uppercase">
                    {role}
                  </span>
                )}
              </div>
            </button>
            
            <div className="flex items-center gap-3 sm:gap-5">
              {navLeft.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    title={item.name}
                    className={cn(
                      "flex flex-col items-center gap-0.5 transition-all duration-300 hover:scale-110 active:scale-95 px-1 sm:px-2",
                      isActive ? "text-sky-600 dark:text-sky-400" : "text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                    )}
                  >
                    <Icon size={20} strokeWidth={isActive ? 2.5 : 2} className={cn(
                      "transition-all duration-300",
                      isActive ? "scale-110" : "group-hover:scale-110"
                    )} />
                    <span className={cn(
                      "text-[9px] sm:text-[10px] font-bold tracking-tight transition-all",
                      isActive ? "opacity-100" : "opacity-70 group-hover:opacity-100"
                    )}>
                      {item.name}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Center: Main Plus Button */}
          <div className="flex justify-center px-2">
            <button
              onClick={() => setIsModalOpen(true)}
              className="bg-sky-500 hover:bg-sky-400 text-white p-3.5 sm:p-4 rounded-2xl -mt-10 sm:-mt-12 shadow-lg shadow-sky-500/40 transition-all duration-300 hover:scale-110 active:scale-95 cursor-pointer outline-none ring-offset-2 focus:ring-2 focus:ring-sky-500 flex items-center justify-center"
            >
              <PlusCircle size={24} strokeWidth={2.5} />
            </button>
          </div>

          {/* Right: NavRight */}
          <div className="flex items-center justify-end gap-3 sm:gap-5 overflow-hidden">
            <div className="flex items-center gap-3 sm:gap-5">
              {navRight.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    title={item.name}
                    className={cn(
                      "flex flex-col items-center gap-0.5 transition-all duration-300 hover:scale-110 active:scale-95 px-1 sm:px-2",
                      isActive ? "text-sky-600 dark:text-sky-400" : "text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                    )}
                  >
                    <Icon size={20} strokeWidth={isActive ? 2.5 : 2} className={cn(
                      "transition-all duration-300",
                      isActive ? "scale-110" : "group-hover:scale-110"
                    )} />
                    <span className={cn(
                      "text-[9px] sm:text-[10px] font-bold tracking-tight transition-all",
                      isActive ? "opacity-100" : "opacity-70 group-hover:opacity-100"
                    )}>
                      {item.name}
                    </span>
                  </Link>
                );
              })}
            </div>
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
              role === 'admin' ? "bg-amber-100 text-amber-600" : "bg-sky-100 text-sky-600"
            )}>
               {role === 'admin' ? <ShieldCheck size={28} /> : <User size={28} />}
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
