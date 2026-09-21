'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { ensureProfile } from './create-profile';
import { supabase } from './supabase';

type AuthContextType = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
  unreadCount: number;
  setUnreadCount: (count: number) => void;
};

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  loading: true,
  signOut: async () => {},
  unreadCount: 0,
  setUnreadCount: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
      setLoading(false);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const user = session?.user;
    if (!user) {
      setUnreadCount(0);
      return;
    }

    void ensureProfile(
      user.id,
      user.email?.split('@')[0] ?? user.user_metadata?.full_name ?? 'Utilisateur'
    );

    let cancelled = false;
    const refreshUnreadCount = async () => {
      const { count } = await supabase
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .eq('receiver_id', user.id)
        .eq('is_read', false);

      if (!cancelled) setUnreadCount(count ?? 0);
    };

    const updatePresence = async (online: boolean) => {
      await supabase
        .from('profiles')
        .update({ is_online: online, last_seen_at: new Date().toISOString() })
        .eq('id', user.id);
    };

    void refreshUnreadCount();
    void updatePresence(true);

    const heartbeat = window.setInterval(() => {
      if (document.visibilityState === 'visible') void updatePresence(true);
    }, 60_000);

    const handleVisibilityChange = () => {
      void updatePresence(document.visibilityState === 'visible');
      if (document.visibilityState === 'visible') void refreshUnreadCount();
    };
    const handleBeforeUnload = () => {
      void updatePresence(false);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    const channel = supabase
      .channel(`notifications-${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages', filter: `receiver_id=eq.${user.id}` },
        () => void refreshUnreadCount(),
      )
      .subscribe();

    return () => {
      cancelled = true;
      window.clearInterval(heartbeat);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      void supabase.removeChannel(channel);
      void updatePresence(false);
    };
  }, [session]);

  const signOut = async () => {
    if (session?.user) {
      await supabase.from('profiles').update({ is_online: false, last_seen_at: new Date().toISOString() }).eq('id', session.user.id);
    }
    await supabase.auth.signOut();
    setSession(null);
  };

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, loading, signOut, unreadCount, setUnreadCount }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
