'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import Link from 'next/link';
import { AlertTriangle, ArrowRight } from 'lucide-react';

export function ConflictsAlert() {
  const [count, setCount] = useState<number>(0);
  const supabase = createClient();

  useEffect(() => {
    const fetchConflicts = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const userId = session.user.id;
      const role = session.user.user_metadata?.ruolo || 'istruttore';

      let query = supabase.from('sync_conflicts').select('id', { count: 'exact' }).eq('resolved', false);
      
      if (role !== 'admin') {
        query = query.filter('payload->_offline_user_id', 'eq', userId);
      }

      const { count: fetchedCount } = await query;
      if (fetchedCount) setCount(fetchedCount);
    };

    fetchConflicts();
  }, [supabase]);

  if (count === 0) return null;

  return (
    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/50 rounded-2xl p-4 mb-4 shadow-sm relative overflow-hidden flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between mx-4 md:mx-0 mt-4">
      <div className="absolute top-0 left-0 w-1 h-full bg-red-500"></div>
      <div className="flex items-center gap-3">
        <div className="bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400 p-2 rounded-xl shrink-0">
          <AlertTriangle size={20} />
        </div>
        <div>
          <h3 className="font-bold text-red-800 dark:text-red-300 text-sm">
            Hai {count} {count === 1 ? 'conflitto' : 'conflitti'} di sincronizzazione!
          </h3>
          <p className="text-xs text-red-600 dark:text-red-400 font-medium">
            Le tue modifiche offline sono state bloccate. Devi risolvere il conflitto.
          </p>
        </div>
      </div>
      <Link 
        href="/gestione/conflitti"
        className="shrink-0 flex items-center justify-center gap-2 bg-red-500 text-white font-bold text-xs uppercase tracking-widest hover:bg-red-600 transition-colors shadow-md shadow-red-500/20 rounded-xl px-4 py-2.5 w-full sm:w-auto"
      >
        Risolvi Ora <ArrowRight size={16} />
      </Link>
    </div>
  );
}
