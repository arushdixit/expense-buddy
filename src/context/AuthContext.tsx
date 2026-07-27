import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Session, User } from '@supabase/supabase-js';
import { fetchCfIdentity, setCfUser, CfUser } from '@/lib/cfAuth';

const DEFAULT_HOUSEHOLD_ID = 'f1adc195-7233-4ad8-9667-b8c1ce14cffa';
const KNOWN_PROFILES: Record<string, { id: string; household_id: string }> = {
    'dixit.arush@gmail.com': {
        id: '01d89e50-1ca2-44d4-9218-34c6f3a08c3c',
        household_id: 'f1adc195-7233-4ad8-9667-b8c1ce14cffa',
    },
    'pamolidutta@gmail.com': {
        id: 'b9180c54-7d52-4782-9157-7989edf85566',
        household_id: 'f1adc195-7233-4ad8-9667-b8c1ce14cffa',
    },
};

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

    const fetchHouseholdId = async (userId: string, email?: string): Promise<string | null> => {
        const normalizedEmail = (email || '').toLowerCase().strip ? (email || '').toLowerCase().trim() : (email || '').toLowerCase();

        if (normalizedEmail && KNOWN_PROFILES[normalizedEmail]) {
            const known = KNOWN_PROFILES[normalizedEmail];
            setHouseholdId(known.household_id);
            setCfUser({ id: known.id, email: normalizedEmail });
            return known.household_id;
        }

        try {
            // Check Supabase profiles table if available
            if (normalizedEmail) {
                const { data: pByEmail } = await supabase
                    .from('profiles')
                    .select('id, household_id')
                    .eq('email', normalizedEmail)
                    .maybeSingle();
                if (pByEmail && pByEmail.household_id) {
                    setHouseholdId(pByEmail.household_id);
                    if (pByEmail.id) {
                        setCfUser({ id: pByEmail.id, email: normalizedEmail });
                    }
                    return pByEmail.household_id;
                }
            }
        } catch {
            // Ignore RLS read errors
        }

        // Fallback to primary household ID without attempting failing POST queries
        setHouseholdId(DEFAULT_HOUSEHOLD_ID);
        return DEFAULT_HOUSEHOLD_ID;
    };

    useEffect(() => {
        const initAuth = async () => {
            try {
                const cfUser: CfUser | null = await fetchCfIdentity();

                if (cfUser) {
                    const hId = await fetchHouseholdId(cfUser.id, cfUser.email);
                    const activeUser = setCfUser(null) || cfUser;

                    const syntheticUser: User = {
                        id: activeUser.id,
                        app_metadata: { provider: 'cloudflare_google_oauth' },
                        user_metadata: { name: activeUser.name, email: activeUser.email },
                        aud: 'authenticated',
                        created_at: new Date().toISOString(),
                        email: activeUser.email,
                        phone: '',
                        role: 'authenticated',
                        updated_at: new Date().toISOString(),
                    };

                    const syntheticSession: Session = {
                        access_token: 'cf-access-token',
                        token_type: 'bearer',
                        expires_in: 86400,
                        refresh_token: 'cf-refresh-token',
                        user: syntheticUser,
                        expires_at: Math.floor(Date.now() / 1000) + 86400,
                    };

                    setUser(syntheticUser);
                    setSession(syntheticSession);
                    setHouseholdId(hId);
                } else {
                    setUser(null);
                    setSession(null);
                    setHouseholdId(null);
                }
            } catch (err) {
                console.error('Auth initialization failed:', err);
            } finally {
                setLoading(false);
            }
        };

        initAuth();
    }, []);

    const signOut = async () => {
        setCfUser(null);
        setUser(null);
        setSession(null);
        setHouseholdId(null);
        try {
            await supabase.auth.signOut();
        } catch {
            // Ignore Supabase auth errors
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
