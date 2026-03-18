import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Loader2, BadgeCheck, Clock, Car, Eye, EyeOff } from 'lucide-react';
import { useToast } from '@/hooks/useToast';
import { TipoPatente, CambioAmmesso, Veicolo } from '@/lib/database.types';

interface PatenteFormProps {
  tipoId?: TipoPatente;
  defaultValues?: {
    tipo: TipoPatente;
    nome: string;
    durata: number;
    cambio: CambioAmmesso;
    veicoli: string[];
    nascosta: boolean;
  };
  onSuccess: () => void;
  onCancel: () => void;
}

const INPUT_CLS = 'w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl py-2.5 px-4 outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all text-sm';
const LABEL_CLS = 'text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide flex items-center gap-1.5';

export const PatenteForm = ({
  tipoId,
  defaultValues,
  onSuccess,
  onCancel,
}: PatenteFormProps) => {
  const [loading, setLoading] = useState(false);
  const [vehicles, setVehicles] = useState<Veicolo[]>([]);
  const { showToast } = useToast();
  const [form, setForm] = useState({
    tipo: defaultValues?.tipo || '' as TipoPatente,
    nome: defaultValues?.nome || '',
    durata: defaultValues?.durata || 60,
    cambio: defaultValues?.cambio || 'manuale' as CambioAmmesso,
    veicoli: defaultValues?.veicoli || [] as string[],
    nascosta: defaultValues?.nascosta || false,
  });

  useEffect(() => {
    if (defaultValues) {
      setForm({
        tipo: defaultValues.tipo,
        nome: defaultValues.nome,
        durata: defaultValues.durata,
        cambio: defaultValues.cambio,
        veicoli: defaultValues.veicoli,
        nascosta: defaultValues.nascosta,
      });
    }
  }, [JSON.stringify(defaultValues)]);

  useEffect(() => {
    const fetchVehicles = async () => {
      const { data } = await supabase.from('veicoli').select('*').order('nome');
      setVehicles(data || []);
    };
    fetchVehicles();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.tipo) return;
    setLoading(true);

    const { error } = await supabase.from('patenti').upsert({
      tipo: form.tipo.toUpperCase() as TipoPatente,
      nome_visualizzato: form.nome || `Patente ${form.tipo.toUpperCase()}`,
      durata_default: Number(form.durata) || 60,
      cambio_ammesso: form.cambio,
      veicoli_abilitati: form.veicoli,
      nascosta: form.nascosta,
    }, { onConflict: 'tipo' });

    setLoading(false);
    if (error) {
      showToast(error.message, 'error');
    } else {
      showToast(tipoId ? 'Categoria aggiornata correttamente' : 'Nuova categoria aggiunta', 'success');
      onSuccess();
    }
  };

  const toggleVehicle = (id: string) => {
    setForm(prev => ({
      ...prev,
      veicoli: prev.veicoli.includes(id)
        ? prev.veicoli.filter(vId => vId !== id)
        : [...prev.veicoli, id]
    }));
  };

  const compatibleVehicles = vehicles.filter(v => v.tipo_patente === form.tipo);

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label htmlFor="tipo" className={LABEL_CLS}>
            <BadgeCheck size={14} /> Codice Categoria
          </label>
          <input
            id="tipo"
            required
            disabled={!!tipoId}
            value={form.tipo}
            title="Codice Categoria"
            onChange={e => setForm(prev => ({ ...prev, tipo: e.target.value.toUpperCase() as TipoPatente }))}
            className={`${INPUT_CLS} ${!!tipoId ? 'opacity-50 cursor-not-allowed' : ''} uppercase font-mono font-bold`}
            placeholder="es. B96"
            maxLength={5}
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="durata" className={LABEL_CLS}>
            <Clock size={14} /> Durata Default (min)
          </label>
          <input
            id="durata"
            required
            type="number"
            min={15}
            max={240}
            step={5}
            value={form.durata}
            title="Durata Default"
            onChange={e => setForm(prev => ({ ...prev, durata: Number(e.target.value) }))}
            className={INPUT_CLS}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label htmlFor="nome" className={LABEL_CLS}>Nome Visualizzato</label>
          <input
            id="nome"
            value={form.nome}
            title="Nome Visualizzato"
            onChange={e => setForm(prev => ({ ...prev, nome: e.target.value }))}
            className={INPUT_CLS}
            placeholder="es. Patente B Standard"
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="cambio" className={LABEL_CLS}>Tipo Cambio Ammesso</label>
          <select
            id="cambio"
            value={form.cambio}
            title="Seleziona Tipo Cambio"
            onChange={e => setForm(prev => ({ ...prev, cambio: e.target.value as CambioAmmesso }))}
            className={INPUT_CLS}
          >
            <option value="manuale">Manuale</option>
            <option value="automatico">Automatico</option>
            <option value="entrambi">Entrambi (M / A)</option>
          </select>
        </div>
      </div>

      <div className="space-y-2">
        <label className={LABEL_CLS}>
          <Car size={14} /> Veicoli Abilitati
        </label>
        {compatibleVehicles.length === 0 ? (
          <div className="p-4 rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800 text-center">
            <p className="text-xs text-zinc-400 italic">
              {form.tipo ? `Nessun veicolo registrato per categoria ${form.tipo}` : 'Inserisci prima la categoria'}
            </p>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {compatibleVehicles.map(v => {
              const selected = form.veicoli.includes(v.id);
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => toggleVehicle(v.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                    selected
                      ? 'bg-purple-600 text-white border-purple-600 shadow-sm shadow-purple-500/20'
                      : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border-transparent hover:border-zinc-300'
                  }`}
                >
                  {v.nome} ({v.targa})
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${form.nascosta ? 'bg-red-100 text-red-600 dark:bg-red-900/20' : 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/20'}`}>
            {form.nascosta ? <EyeOff size={18} /> : <Eye size={18} />}
          </div>
          <div>
            <p className="text-sm font-bold text-zinc-900 dark:text-zinc-50">Stato Categoria</p>
            <p className="text-xs text-zinc-500">{form.nascosta ? 'Nascosta (Disattivata)' : 'Visibile (Attiva)'}</p>
          </div>
        </div>
        <button
          type="button"
          title="Attiva/Disattiva Categoria"
          onClick={() => setForm(prev => ({ ...prev, nascosta: !prev.nascosta }))}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${form.nascosta ? 'bg-zinc-300 dark:bg-zinc-700' : 'bg-purple-600'}`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${form.nascosta ? 'translate-x-1' : 'translate-x-6'}`}
          />
        </button>
      </div>

      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 py-3 rounded-xl font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all text-sm"
        >
          Annulla
        </button>
        <button
          disabled={loading || !form.tipo}
          type="submit"
          className="flex-1 py-3 rounded-xl font-semibold bg-purple-600 text-white shadow-lg shadow-purple-500/20 hover:bg-purple-700 transition-all flex items-center justify-center text-sm disabled:opacity-50"
        >
          {loading ? <Loader2 className="animate-spin" size={18} /> : (tipoId ? 'Salva Modifiche' : 'Aggiungi Categoria')}
        </button>
      </div>
    </form>
  );
};
