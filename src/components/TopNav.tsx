import { createClient } from '@/utils/supabase/server';
import { LogOut, User } from 'lucide-react';
import { redirect } from 'next/navigation';

export default async function TopNav() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  const handleLogout = async () => {
    'use server';
    const supabaseAction = await createClient();
    await supabaseAction.auth.signOut();
    redirect('/login');
  };

  return (
    <div className="fixed top-0 left-0 w-full bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border-b border-zinc-200/50 dark:border-zinc-800/50 z-50 animate-in fade-in slide-in-from-top-4 duration-500">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3 text-sm font-bold text-zinc-900 dark:text-zinc-50">
          <div className="w-9 h-9 rounded-2xl bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
            <User size={18} strokeWidth={2.5} />
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] text-zinc-400 uppercase tracking-widest leading-none mb-1">Loggato come</span>
            <span className="truncate max-w-[150px] sm:max-w-[250px] leading-none">
              {user.user_metadata?.full_name || user.email}
            </span>
          </div>
        </div>
        
        <form action={handleLogout}>
          <button 
            type="submit" 
            className="flex items-center gap-2 text-xs font-bold text-red-600 dark:text-red-400 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 px-4 py-2.5 rounded-xl transition-all"
          >
            <LogOut size={16} strokeWidth={2.5} />
            Esci
          </button>
        </form>
      </div>
    </div>
  );
}
