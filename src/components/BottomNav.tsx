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
      <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-lg z-50">
        <div className="glass flex items-center justify-around py-3 px-6 rounded-[40px] shadow-2xl border border-white/20 dark:border-white/10">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;

            if (item.isMain) {
              return (
                <button
                  key={item.name}
                  onClick={() => setIsModalOpen(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white p-4 rounded-full -mt-12 shadow-lg shadow-blue-500/30 transition-all duration-300 hover:scale-110 active:scale-95 cursor-pointer outline-none ring-offset-2 focus:ring-2 focus:ring-blue-500"
                >
                  <Icon size={28} />
                </button>
              );
            }

            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "flex flex-col items-center gap-1 transition-all duration-300 hover:scale-110 active:scale-95",
                  isActive ? "text-blue-600 dark:text-blue-400" : "text-zinc-500 dark:text-zinc-400"
                )}
              >
                <Icon size={24} strokeWidth={isActive ? 2.5 : 2} />
                <span className="text-[10px] font-medium">{item.name}</span>
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
