import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

export interface Profile {
  id: string;
  name: string | null;
  phone: string | null;
  skill_level: string | null;
  avatar_url: string | null;
}

interface SignUpResult {
  error: any;
  user: User | null;
  session: Session | null;
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, pass: string) => Promise<{ error: any }>;
  signUp: (name: string, email: string, pass: string, phone?: string) => Promise<SignUpResult>;
  resetPassword: (email: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  profile: null,
  loading: true,
  signIn: async () => ({ error: null }),
  signUp: async () => ({ error: null, user: null, session: null }),
  resetPassword: async () => ({ error: null }),
  signOut: async () => {},
  refreshProfile: async () => {},
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (!error && data) {
        setProfile(data);
      } else {
        setProfile({
          id: userId,
          name: user?.user_metadata?.name || user?.email?.split('@')[0] || 'Player',
          phone: user?.user_metadata?.phone || null,
          skill_level: 'intermediate',
          avatar_url: null,
        });
      }
    } catch (e) {
      console.warn('Error fetching profile:', e);
    }
  };

  useEffect(() => {
    supabase.auth.getSession()
      .then(({ data }) => {
        const session = data?.session ?? null;
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          fetchProfile(session.user.id);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.warn('Supabase getSession network/auth notice:', err?.message || err);
        setLoading(false);
      });

    const { data: authListener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        await fetchProfile(session.user.id);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, pass: string) => {
    const { error, data } = await supabase.auth.signInWithPassword({
      email,
      password: pass,
    });
    if (data?.user) {
      await fetchProfile(data.user.id);
    }
    return { error };
  };

  const signUp = async (name: string, email: string, pass: string, phone?: string): Promise<SignUpResult> => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password: pass,
      options: {
        data: {
          name,
          phone: phone || null,
        },
      },
    });

    if (!error && data.user) {
      try {
        await supabase.from('profiles').upsert({
          id: data.user.id,
          name,
          phone: phone || null,
        });
        if (data.session) {
          await fetchProfile(data.user.id);
        }
      } catch (err) {
        console.warn('Profile upsert notice:', err);
      }
    }
    return { error, user: data?.user || null, session: data?.session || null };
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
    return { error };
  };

  const signOut = async () => {
    setLoading(true);
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setProfile(null);
    setLoading(false);
  };

  const refreshProfile = async () => {
    if (user?.id) {
      await fetchProfile(user.id);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        profile,
        loading,
        signIn,
        signUp,
        resetPassword,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
