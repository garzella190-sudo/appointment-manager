'use client';

import React, { useState, useEffect } from 'react';
import { Users, Truck, UserCircle, Search, Plus, MoreVertical, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { Trainer, Vehicle, Customer } from '@/types';
import { Modal } from '@/components/Modal';
import { TrainerForm } from '@/components/forms/TrainerForm';
import { VehicleForm } from '@/components/forms/VehicleForm';
import { CustomerForm } from '@/components/forms/CustomerForm';

type Tab = 'trainers' | 'vehicles' | 'customers';

export default function ManagementPage() {
  const [activeTab, setActiveTab] = useState<Tab>('trainers');
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [data, setData] = useState<{
    trainers: Trainer[];
    vehicles: Vehicle[];
    customers: Customer[];
  }>({
    trainers: [],
    vehicles: [],
    customers: [],
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [trainersRes, vehiclesRes, customersRes] = await Promise.all([
        supabase.from('trainers').select('*').order('name'),
        supabase.from('vehicles').select('*').order('plate'),
        supabase.from('customers').select('*').order('name'),
      ]);

      setData({
        trainers: trainersRes.data || [],
        vehicles: vehiclesRes.data || [],
        customers: customersRes.data || [],
      });
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const tabs = [
    { id: 'trainers', label: 'Istruttori', icon: Users },
    { id: 'vehicles', label: 'Veicoli', icon: Truck },
    { id: 'customers', label: 'Clienti', icon: UserCircle },
  ];

  const activeListData = data[activeTab];

  const handleSuccess = () => {
    setIsModalOpen(false);
    fetchData();
  };

  return (
    <div className="p-6 md:p-10 max-w-5xl mx-auto animate-fade-in">
      <header className="mb-8">
        <h1 className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Gestione</h1>
        <p className="text-zinc-500 dark:text-zinc-400 mt-1">Configura le risorse della tua attività</p>
      </header>

      {/* Tabs */}
      <div className="flex bg-zinc-100 dark:bg-zinc-900/50 p-1.5 rounded-2xl mb-8 w-fit">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as Tab)}
              className={cn(
                "flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold transition-all",
                isActive 
                  ? "bg-white dark:bg-zinc-800 text-blue-600 dark:text-blue-400 shadow-sm" 
                  : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
              )}
            >
              <Icon size={18} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Search and Action */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="relative flex-1 group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-blue-500 transition-colors" size={20} />
          <input 
            type="text" 
            placeholder={`Cerca ${activeTab}...`}
            className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl py-3 pl-12 pr-4 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
          />
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white rounded-2xl px-6 py-3 font-semibold flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 transition-all hover:scale-[1.02] active:scale-95"
        >
          <Plus size={20} />
          Nuovo {activeTab.slice(0, -1)}
        </button>
      </div>

      {/* List */}
      <div className="glass-card overflow-hidden">
        {loading ? (
          <div className="p-20 flex flex-col items-center justify-center gap-4 text-zinc-400">
            <Loader2 className="animate-spin" size={40} />
            <p>Caricamento dati...</p>
          </div>
        ) : activeListData.length > 0 ? (
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {activeListData.map((item: any) => (
              <div key={item.id} className="p-5 flex items-center justify-between hover:bg-zinc-50/50 dark:hover:bg-zinc-800/20 transition-colors group">
                <div className="flex items-center gap-4">
                  <div className={cn(
                    "w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg",
                    activeTab === 'trainers' ? "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20" :
                    activeTab === 'vehicles' ? "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20" :
                    "text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20"
                  )} style={activeTab === 'trainers' ? { backgroundColor: item.color + '20', color: item.color } : {}}>
                    {activeTab === 'trainers' ? item.name[0] : 
                     activeTab === 'vehicles' ? item.plate.slice(0, 2) : 
                     item.name[0]}
                  </div>
                  <div>
                    <h4 className="font-bold text-zinc-900 dark:text-zinc-50">
                      {activeTab === 'vehicles' ? item.plate : item.name}
                    </h4>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">
                      {item.phone || (activeTab === 'vehicles' ? item.name : 'Nessun telefono')}
                    </p>
                  </div>
                </div>
                <button className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors">
                  <MoreVertical size={20} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-20 text-center text-zinc-400">
            Nessun {activeTab} trovato. Clicca su "Nuovo" per aggiungerne uno.
          </div>
        )}
      </div>

      {/* Modal */}
      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title={`Nuovo ${activeTab === 'trainers' ? 'Istruttore' : activeTab === 'vehicles' ? 'Veicolo' : 'Cliente'}`}
      >
        {activeTab === 'trainers' && <TrainerForm onSuccess={handleSuccess} onCancel={() => setIsModalOpen(false)} />}
        {activeTab === 'vehicles' && <VehicleForm onSuccess={handleSuccess} onCancel={() => setIsModalOpen(false)} />}
        {activeTab === 'customers' && <CustomerForm onSuccess={handleSuccess} onCancel={() => setIsModalOpen(false)} />}
      </Modal>
    </div>
  );
}
