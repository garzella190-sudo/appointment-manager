import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import { AlertCircle, CheckCircle, Trash2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { discardConflictAction, forceResolveConflictAction } from '@/actions/conflitti';
import { ConflictRow } from './ConflictRow';

export default async function ConflittiPage() {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    redirect('/login');
  }

  const role = session.user.user_metadata?.ruolo || 'istruttore';
  const userId = session.user.id;

  let query = supabase
    .from('sync_conflicts')
    .select('*')
    .eq('resolved', false)
    .order('created_at', { ascending: false });

  if (role !== 'admin') {
    query = query.filter('payload->_offline_user_id', 'eq', userId);
  }

  const { data: conflicts } = await query;

  return (
    <div className="p-4 sm:p-6 space-y-6 pb-24">
      <div className="flex items-center gap-3">
        <Link href="/gestione" className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-2xl font-black uppercase tracking-tight flex items-center gap-2">
            Risoluzione Conflitti
            {conflicts && conflicts.length > 0 && (
              <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
                {conflicts.length}
              </span>
            )}
          </h1>
          <p className="text-sm text-zinc-500 font-medium">
            Modifiche offline che hanno generato errori di sovrapposizione al ritorno online.
          </p>
        </div>
      </div>

      {!conflicts || conflicts.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 bg-zinc-50 dark:bg-zinc-900/50 rounded-3xl border border-zinc-100 dark:border-zinc-800">
          <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-4">
            <CheckCircle size={32} />
          </div>
          <h2 className="text-xl font-bold">Tutto pulito!</h2>
          <p className="text-zinc-500 text-center text-sm max-w-sm mt-2">
            Non ci sono conflitti di sincronizzazione in sospeso.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {conflicts.map((conflict) => (
            <ConflictRow key={conflict.id} conflict={conflict} />
          ))}
        </div>
      )}
    </div>
  );
}
