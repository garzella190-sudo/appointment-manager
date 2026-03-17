'use client';

import React, { useState } from 'react';
import { syncAppointmentsToSlotsAction } from '@/actions/appointment_actions';
import { ShieldCheck, Loader2 } from 'lucide-react';

export default function SanityCheckButton() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const handleSync = async () => {
    setLoading(true);
    setResult(null);
    try {
      const res = await syncAppointmentsToSlotsAction();
      if (res.success) {
        setResult(`Successo! Sincronizzate ${res.count} guide.`);
      } else {
        setResult(`Errore: ${res.error}`);
      }
    } catch (e) {
      setResult('Errore fatale durante la sincronizzazione');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-8 p-6 bg-blue-50 dark:bg-blue-900/10 rounded-[32px] border border-blue-100 dark:border-blue-800/50">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-black text-blue-900 dark:text-blue-100 flex items-center gap-2">
            <ShieldCheck className="text-blue-600" />
            Sanity Check Agenda
          </h3>
          <p className="text-sm text-blue-700/70 dark:text-blue-300/60 mt-1">
            Sincronizza gli slot temporali con gli appuntamenti esistenti per eliminare sovrapposizioni e "ghost slots".
          </p>
        </div>
        <button
          onClick={handleSync}
          disabled={loading}
          className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 transition-all disabled:opacity-50"
        >
          {loading ? <Loader2 className="animate-spin" size={20} /> : 'Esegui Sync Agora'}
        </button>
      </div>
      {result && (
        <p className="mt-4 text-sm font-bold text-center text-blue-600 animate-fade-in">{result}</p>
      )}
    </div>
  );
}
