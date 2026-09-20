import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';

export type Profile = {
  id: string;
  email: string;
  display_name: string;
  avatar_color: string;
  auth_provider: 'password' | 'google';
  onboarded: boolean;
};

const PROFILE_COLUMNS = 'id, email, display_name, avatar_color, auth_provider, onboarded';

type AuthState = {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadProfile(userId: string) {
    const { data } = await supabase
      .from('profiles')
      .select(PROFILE_COLUMNS)
      .eq('id', userId)
      .maybeSingle();

    if (data) {
      setProfile(data as Profile);
      return;
    }

    // Signed in with no profile row — possible for anyone who signed up before
    // the signup trigger existed. Without one, creating a plan fails on a
    // foreign key with a baffling error, so repair it rather than carry on.
    const { data: created, error } = await supabase.rpc('ensure_profile');
    if (error) {
      console.warn('could not create the missing profile', error);
      setProfile(null);
      return;
    }
    setProfile((Array.isArray(created) ? created[0] : created) as Profile);
  }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      if (data.session) await loadProfile(data.session.user.id);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, next) => {
      setSession(next);
      if (next) await loadProfile(next.user.id);
      else setProfile(null);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider
      value={{
        session,
        profile,
        loading,
        refreshProfile: async () => {
          if (session) await loadProfile(session.user.id);
        },
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
