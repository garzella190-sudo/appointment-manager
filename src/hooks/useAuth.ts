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
    const MAX_SESSION_DURATION = 3.5 * 60 * 60 * 1000; // 3 ore 30 minuti in millisecondi

    async function checkSessionTimeout() {
      const loginTimeStr = localStorage.getItem('auth_login_time');
      if (loginTimeStr) {
        const loginTime = parseInt(loginTimeStr, 10);
        if (Date.now() - loginTime > MAX_SESSION_DURATION) {
          localStorage.removeItem('auth_login_time');
          await supabase.auth.signOut();
          window.location.href = '/login';
          return true;
        }
      }
      return false;
    }

    async function getSession() {
      const isLoggedOut = await checkSessionTimeout();
      if (isLoggedOut) return;

      const { data: { user }, error } = await supabase.auth.getUser();
      
      if (user) {
        setUser(user);
        setRole(user.user_metadata?.role as UserRole || 'istruttore');
        setIstruttoreId(user.user_metadata?.istruttore_id || null);
        if (!localStorage.getItem('auth_login_time')) {
          localStorage.setItem('auth_login_time', Date.now().toString());
        }
      }
      
      setLoading(false);
    }

    getSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event: AuthChangeEvent, session: Session | null) => {
      const isLoggedOut = await checkSessionTimeout();
      if (isLoggedOut) return;

      if (session?.user) {
        setUser(session.user);
        setRole(session.user.user_metadata?.role as UserRole || 'istruttore');
        setIstruttoreId(session.user.user_metadata?.istruttore_id || null);
        if (!localStorage.getItem('auth_login_time')) {
          localStorage.setItem('auth_login_time', Date.now().toString());
        }
      } else {
        setUser(null);
        setRole(null);
        setIstruttoreId(null);
        localStorage.removeItem('auth_login_time');
      }
      setLoading(false);
    });

    // Controllo di sicurezza ogni minuto
    const checkInterval = setInterval(async () => {
      await checkSessionTimeout();
    }, 60000);

    return () => {
      subscription.unsubscribe();
      clearInterval(checkInterval);
    };
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
