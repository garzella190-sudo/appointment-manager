import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { User, AuthChangeEvent, Session } from '@supabase/supabase-js';

const supabase = createClient();

export type UserRole = 'admin' | 'AdminDev' | 'istruttore' | 'segreteria';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [istruttoreId, setIstruttoreId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function getSession() {
      const { data: { user }, error } = await supabase.auth.getUser();
      
      if (user) {
        setUser(user);
        setRole(user.user_metadata?.role as UserRole || 'istruttore');
        setIstruttoreId(user.user_metadata?.istruttore_id || null);
      }
      
      setLoading(false);
    }

    getSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: AuthChangeEvent, session: Session | null) => {
      if (session?.user) {
        setUser(session.user);
        setRole(session.user.user_metadata?.role as UserRole || 'istruttore');
        setIstruttoreId(session.user.user_metadata?.istruttore_id || null);
      } else {
        setUser(null);
        setRole(null);
        setIstruttoreId(null);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  return { 
    user, 
    role, 
    istruttoreId, 
    permissions: user?.user_metadata?.permissions || {},
    isAdmin: role === 'admin' || role === 'AdminDev',
    isSegreteria: role === 'segreteria',
    isIstruttore: role === 'istruttore',
    loading 
  };
}
