'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
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

function getDeviceSessionKey(userId: string) {
  const storageKey = `aras-device-session-${userId}`;
  let sessionKey = window.localStorage.getItem(storageKey);
  if (!sessionKey) {
    sessionKey = typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    window.localStorage.setItem(storageKey, sessionKey);
  }
  return sessionKey;
}

function getDeviceLabel() {
  const ua = navigator.userAgent;
  const device = /tablet|ipad/i.test(ua) ? 'Tablette' : /mobile|android|iphone/i.test(ua) ? 'Téléphone' : 'Ordinateur';
  const browser = /edg/i.test(ua) ? 'Edge' : /firefox/i.test(ua) ? 'Firefox' : /chrome/i.test(ua) ? 'Chrome' : /safari/i.test(ua) ? 'Safari' : 'Navigateur';
  return `${device} · ${browser}`;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    let disposed = false;
    let authEventRevision = 0;
    const { data: listener } = supabase.auth.onAuthStateChange((event, sess) => {
      authEventRevision += 1;
      const revision = authEventRevision;
      if (event === 'SIGNED_IN' && sess?.access_token) {
        void fetch('/api/auth/reactivate-account', {
          method: 'POST',
          headers: { Authorization: `Bearer ${sess.access_token}` },
        }).catch(() => null).finally(() => {
          if (disposed || revision !== authEventRevision) return;
          setSession(sess);
          setLoading(false);
        });
        return;
      }
      setSession(sess);
      setLoading(false);
    });

    const initialRevision = authEventRevision;
    void supabase.auth.getSession().then(
      ({ data, error }) => {
        if (disposed || authEventRevision !== initialRevision) return;
        setSession(error ? null : data.session);
        setLoading(false);
      },
      () => {
        if (disposed || authEventRevision !== initialRevision) return;
        setSession(null);
        setLoading(false);
      },
    );

    return () => {
      disposed = true;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const user = session?.user;
    if (!user) {
      setUnreadCount(0);
      return;
    }

    let cancelled = false;
    const verifyAccountAccess = async () => {
      const accessToken = session?.access_token;
      if (!accessToken) return;
      const response = await fetch('/api/auth/access', { headers: { Authorization: `Bearer ${accessToken}` } }).catch(() => null);
      if (!cancelled && (response?.status === 401 || response?.status === 403)) {
        await supabase.auth.signOut({ scope: 'local' });
        setSession(null);
      }
    };
    void verifyAccountAccess();
    const accessCheck = window.setInterval(() => void verifyAccountAccess(), 60_000);
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
      const sessionKey = getDeviceSessionKey(user.id);
      await supabase.from('account_sessions').upsert({
        user_id: user.id,
        session_key: sessionKey,
        device_label: getDeviceLabel(),
        last_seen_at: new Date().toISOString(),
      }, { onConflict: 'user_id,session_key' });
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
    window.addEventListener('focus', verifyAccountAccess);

    const channel = supabase
      .channel(`notifications-${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages', filter: `receiver_id=eq.${user.id}` },
        () => void refreshUnreadCount(),
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${user.id}` },
        (payload) => {
          const updatedProfile = payload.new as { is_active?: boolean; is_temporarily_deactivated?: boolean };
          if (updatedProfile.is_active === false || updatedProfile.is_temporarily_deactivated === true) {
            setSession(null);
            void supabase.auth.signOut({ scope: 'local' });
          }
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      window.clearInterval(accessCheck);
      window.clearInterval(heartbeat);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('focus', verifyAccountAccess);
      void supabase.removeChannel(channel);
      void updatePresence(false);
    };
  }, [session]);

  const signOut = async () => {
    const userId = session?.user.id;
    setSession(null);
    setUnreadCount(0);
    if (userId) {
      const sessionKey = getDeviceSessionKey(userId);
      void supabase.from('account_sessions').delete().eq('user_id', userId).eq('session_key', sessionKey);
      void supabase.from('profiles').update({ is_online: false, last_seen_at: new Date().toISOString() }).eq('id', userId);
    }
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, loading, signOut, unreadCount, setUnreadCount }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
