'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Calendar, Home, UserCircle, PlusCircle, Wrench, User, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Modal } from './Modal';
import { AppointmentForm } from './forms/AppointmentForm';
import { ConfirmBubble } from './ConfirmBubble';
import { signOutAction } from '@/actions/auth';

interface BottomNavProps {
  user?: {
    email?: string | null;
    full_name?: string | null;
  } | null;
}

const BottomNav = ({ user }: BottomNavProps) => {
  const pathname = usePathname();
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  if (pathname === '/login') {
    return null;
  }

  const handleLogout = async () => {
    setIsLoggingOut(true);
    await signOutAction();
    router.push('/login');
    router.refresh();
  };

  const navItems = [
    { name: 'Home',      href: '/',         icon: Home },
    { name: 'Calendario', href: '/calendar', icon: Calendar },
    { name: 'Nuovo',    href: '#',         icon: PlusCircle, isMain: true },
    { name: 'Clienti',  href: '/clienti',  icon: UserCircle },
    { name: 'Gestione', href: '/gestione', icon: Wrench },
  ];

  return (
    <>
      <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[98%] max-w-2xl z-50 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="bg-white/90 dark:bg-zinc-900/90 backdrop-blur-xl flex items-center justify-between py-2 px-3 sm:px-6 rounded-[32px] shadow-[0_20px_50px_rgba(0,0,0,0.1)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.3)] border border-zinc-200/50 dark:border-zinc-800/50">
          
          {/* User Profile - Left */}
          <div className="flex items-center gap-2 px-2 min-w-0 max-w-[100px] sm:max-w-[150px]">
            <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 shadow-inner">
              <User size={16} strokeWidth={2.5} />
            </div>
            <div className="hidden lg:flex flex-col min-w-0">
              <span className="text-[10px] font-bold text-zinc-900 dark:text-zinc-100 truncate">
                {user?.full_name?.split(' ')[0] || user?.email?.split('@')[0] || 'Utente'}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-around flex-1 px-2 gap-1 sm:gap-4">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;

              if (item.isMain) {
                return (
                  <button
                    key={item.name}
                    onClick={() => setIsModalOpen(true)}
                    title={item.name}
                    className="bg-blue-600 hover:bg-blue-500 text-white p-3 sm:p-3.5 rounded-2xl -mt-10 sm:-mt-12 shadow-lg shadow-blue-500/40 transition-all duration-300 hover:scale-110 active:scale-95 cursor-pointer outline-none ring-offset-2 focus:ring-2 focus:ring-blue-500"
                  >
                    <Icon size={24} strokeWidth={2.5} />
                  </button>
                );
              }

              return (
                <Link
                  key={item.name}
                  href={item.href}
                  title={item.name}
                  onClick={() => {
                    // Force refresh on every navigation click for "security/freshness" on mobile
                    router.refresh();
                  }}
                  className={cn(
                    "flex flex-col items-center gap-0.5 transition-all duration-300 hover:scale-110 active:scale-95 px-1 sm:px-2",
                    isActive ? "text-blue-600 dark:text-blue-400" : "text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
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

          {/* Logout - Right */}
          <ConfirmBubble
            title="Esci dall'app"
            message="Vuoi terminare la sessione attuale?"
            confirmLabel="Esci"
            onConfirm={handleLogout}
            trigger={
              <button
                disabled={isLoggingOut}
                className="flex flex-col items-center gap-0.5 px-2 text-red-500 hover:text-red-600 transition-all active:scale-90 disabled:opacity-50"
                title="Esci"
              >
                <LogOut size={20} strokeWidth={2.5} />
                <span className="text-[9px] sm:text-[10px] font-bold tracking-tight">Esci</span>
              </button>
            }
          />
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
          }} 
          onCancel={() => setIsModalOpen(false)} 
        />
      </Modal>
    </>
  );
};

export default BottomNav;
