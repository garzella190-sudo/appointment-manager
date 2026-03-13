'use client';

import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Loader2 } from 'lucide-react';

interface FormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

export const VehicleForm = ({ onSuccess, onCancel }: FormProps) => {
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    
    const { error } = await supabase.from('vehicles').insert({
      plate: (formData.get('plate') as string).toUpperCase(),
      name: formData.get('name'),
      license_types: (formData.get('license_types') as string).split(',').map(s => s.trim()),
    });

    setLoading(false);
    if (!error) onSuccess();
    else alert(error.message);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-zinc-500">Targa</label>
          <input 
            required 
            name="plate"
            className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl py-2.5 px-4 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            placeholder="es. AA123BB"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-zinc-500">Modello (Opzionale)</label>
          <input 
            name="name"
            className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl py-2.5 px-4 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            placeholder="es. Fiat Panda"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-semibold text-zinc-500">Categorie Patente (separate da virgola)</label>
        <input 
          required 
          name="license_types"
          className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl py-2.5 px-4 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
          placeholder="es. A, B, B96"
        />
      </div>

      <div className="flex gap-3 pt-4">
        <button 
          type="button"
          onClick={onCancel}
          className="flex-1 py-3 rounded-xl font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all"
        >
          Annulla
        </button>
        <button 
          disabled={loading}
          type="submit"
          className="flex-1 py-3 rounded-xl font-semibold bg-emerald-600 text-white shadow-lg shadow-emerald-500/20 hover:bg-emerald-700 transition-all flex items-center justify-center"
        >
          {loading ? <Loader2 className="animate-spin" size={20} /> : 'Salva Veicolo'}
        </button>
      </div>
    </form>
  );
};
