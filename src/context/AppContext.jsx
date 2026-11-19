import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { supabase, supabaseConfigError } from '../../supabase.js';
import { STATUS } from '../lib/status.js';

const AppContext = createContext(null);

/**
 * @param {{ children: import('react').ReactNode }} props
 */
export function AppProvider({ children }) {
  const [session, setSession] = useState(null);
  const [authStatus, setAuthStatus] = useState(supabase ? STATUS.LOADING : STATUS.ERROR);
  const [authError, setAuthError] = useState(supabaseConfigError);
  const [profile, setProfile] = useState(null);
  const [role, setRole] = useState(null);

  useEffect(() => {
    if (!supabase) return undefined;
    let active = true;
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return;
      setSession(nextSession);
      setAuthStatus(STATUS.SUCCESS);
    });

    supabase.auth.getSession()
      .then(({ data, error }) => {
        if (!active) return;
        if (error) throw error;
        setSession(data.session);
        setAuthStatus(STATUS.SUCCESS);
      })
      .catch(() => {
        if (!active) return;
        setAuthError('Não foi possível verificar sua sessão. Tente novamente.');
        setAuthStatus(STATUS.ERROR);
      });

    return () => {
      active = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo(() => ({
    session,
    user: session?.user ?? null,
    profile,
    setProfile,
    role,
    setRole,
    authStatus,
    authError,
    setAuthError,
    refreshSession: async () => {
      if (!supabase) return null;
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;
      setSession(data.session);
      return data.session;
    },
  }), [session, profile, role, authStatus, authError]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useAppContext deve ser usado dentro de AppProvider.');
  return context;
}
