import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Session, User } from '@supabase/supabase-js';

interface AuthContextType {
    session: Session | null;
    user: User | null;
    householdId: string | null;
    loading: boolean;
    signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
    session: null,
    user: null,
    householdId: null,
    loading: true,
    signOut: async () => { },
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [householdId, setHouseholdId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchHouseholdId = async (userId: string, email?: string) => {
        try {
            // Fetch profile household_id by user_id or email
            let { data, error } = await supabase
                .from('profiles')
                .select('household_id')
                .eq('id', userId)
                .maybeSingle();

            if (!data && email) {
                const { data: pByEmail } = await supabase
                    .from('profiles')
                    .select('household_id')
                    .eq('email', email)
                    .maybeSingle();
                data = pByEmail;
            }

            if (data && data.household_id) {
                setHouseholdId(data.household_id);
                return data.household_id;
            }

            // Fallback: Check existing households or assign default
            let { data: household } = await supabase.from('households').select('id').limit(1).maybeSingle();
            let hId = household?.id;

            if (!hId) {
                const { data: newH } = await supabase.from('households').insert({ name: 'Our Home' }).select().maybeSingle();
                hId = newH?.id;
            }

            if (hId) {
                setHouseholdId(hId);
                // Create or update profile record
                await supabase.from('profiles').upsert({
                    id: userId,
                    email: email,
                    household_id: hId
                });
            }
            return hId || null;
        } catch (err) {
            console.error('Error in fetchHouseholdId:', err);
            return null;
        }
    };

    useEffect(() => {
        let isSubscribed = true;

        const initAuth = async () => {
            // Check current active Supabase Auth session
            const { data: { session: currentSession } } = await supabase.auth.getSession();

            if (currentSession?.user) {
                if (isSubscribed) {
                    setSession(currentSession);
                    setUser(currentSession.user);
                    await fetchHouseholdId(currentSession.user.id, currentSession.user.email);
                    setLoading(false);
                }
                return;
            }

            // Auto Cloudflare SSO redirect on production if no active session
            const isProd = window.location.hostname.includes('arushpamoli.com');
            const isProcessingHash = window.location.hash.includes('access_token');

            if (isProd && !isProcessingHash && !session) {
                // Auto-trigger Cloudflare SSO magic link bridge
                window.location.href = '/api/cf-auth';
                return;
            }

            if (isSubscribed) {
                setLoading(false);
            }
        };

        initAuth();

        // Listen for Supabase auth state changes (e.g. magic link redirect callback)
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
            if (newSession?.user) {
                setSession(newSession);
                setUser(newSession.user);
                await fetchHouseholdId(newSession.user.id, newSession.user.email);
            } else {
                setSession(null);
                setUser(null);
                setHouseholdId(null);
            }
            setLoading(false);
        });

        return () => {
            isSubscribed = false;
            subscription.unsubscribe();
        };
    }, []);

    const signOut = async () => {
        setSession(null);
        setUser(null);
        setHouseholdId(null);
        try {
            await supabase.auth.signOut();
        } catch {
            // Ignore auth errors
        }
        window.location.href = '/cdn-cgi/access/logout';
    };

    return (
        <AuthContext.Provider value={{ session, user, householdId, loading, signOut }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    return useContext(AuthContext);
};
