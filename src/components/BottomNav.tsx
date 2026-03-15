'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Calendar, Home, UserCircle, PlusCircle, Wrench } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Modal } from './Modal';
import { AppointmentForm } from './forms/AppointmentForm';

const BottomNav = () => {
  const pathname = usePathname();
  const [isModalOpen, setIsModalOpen] = useState(false);

  if (pathname === '/login') {
    return null;
  }

  const navItems = [
    { name: 'Home',      href: '/',         icon: Home },
    { name: 'Calendario', href: '/calendar', icon: Calendar },
    { name: 'Nuovo',    href: '#',         icon: PlusCircle, isMain: true },
    { name: 'Clienti',  href: '/clienti',  icon: UserCircle },
    { name: 'Gestione', href: '/gestione', icon: Wrench },
  ];

  return (
    <>
      <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[92%] max-w-lg z-50 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl flex items-center justify-around py-3 px-6 rounded-[32px] shadow-[0_20px_50px_rgba(0,0,0,0.1)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.3)] border border-zinc-200/50 dark:border-zinc-800/50">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;

            if (item.isMain) {
              return (
                <button
                  key={item.name}
                  onClick={() => setIsModalOpen(true)}
                  className="bg-blue-600 hover:bg-blue-500 text-white p-4 rounded-2xl -mt-14 shadow-lg shadow-blue-500/40 transition-all duration-300 hover:scale-110 active:scale-95 cursor-pointer outline-none ring-offset-2 focus:ring-2 focus:ring-blue-500"
                >
                  <Icon size={28} strokeWidth={2.5} />
                </button>
              );
            }

            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "flex flex-col items-center gap-1 transition-all duration-300 hover:scale-110 active:scale-95 px-2",
                  isActive ? "text-blue-600 dark:text-blue-400" : "text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                )}
              >
                <Icon size={22} strokeWidth={isActive ? 2.5 : 2} className={cn(
                  "transition-all duration-300",
                  isActive ? "scale-110" : "group-hover:scale-110"
                )} />
                <span className={cn(
                  "text-[10px] font-bold tracking-tight transition-all",
                  isActive ? "opacity-100" : "opacity-70 group-hover:opacity-100"
                )}>
                  {item.name}
                </span>
              </Link>
            );
          })}
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
            // Non possiamo forzare il refresh di altre pagine facilmente da qui senza un gestore di stato o context,
            // ma l'utente vedrà i dati aggiornati navigando o con il refresh automatico di Next.js se configurato.
            window.location.reload(); 
          }} 
          onCancel={() => setIsModalOpen(false)} 
        />
      </Modal>
    </>
  );
};

export default BottomNav;
