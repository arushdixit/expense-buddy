import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Session, User } from '@supabase/supabase-js';
import { fetchCfIdentity, setCfUser, getCfUser, CfUser } from '@/lib/cfAuth';

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

const createSyntheticSession = (cfUser: CfUser): { user: User; session: Session } => {
    const syntheticUser: User = {
        id: cfUser.id,
        app_metadata: { provider: 'cloudflare_google_oauth' },
        user_metadata: { name: cfUser.name || cfUser.email.split('@')[0], email: cfUser.email },
        aud: 'authenticated',
        created_at: new Date().toISOString(),
        email: cfUser.email,
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

    return { user: syntheticUser, session: syntheticSession };
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
    const initialCfUser = getCfUser();
    const initialSessionData = initialCfUser ? createSyntheticSession(initialCfUser) : null;

    const [user, setUser] = useState<User | null>(initialSessionData?.user || null);
    const [session, setSession] = useState<Session | null>(initialSessionData?.session || null);
    const [householdId, setHouseholdId] = useState<string | null>(DEFAULT_HOUSEHOLD_ID);
    const [loading, setLoading] = useState<boolean>(!initialSessionData);

    const resolveHouseholdId = async (userId: string, email?: string): Promise<string> => {
        const normalizedEmail = (email || '').toLowerCase().trim();

        if (normalizedEmail && KNOWN_PROFILES[normalizedEmail]) {
            const known = KNOWN_PROFILES[normalizedEmail];
            setHouseholdId(known.household_id);
            setCfUser({ id: known.id, email: normalizedEmail });
            return known.household_id;
        }

        try {
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
            // Ignore RLS errors
        }

        setHouseholdId(DEFAULT_HOUSEHOLD_ID);
        return DEFAULT_HOUSEHOLD_ID;
    };

    useEffect(() => {
        let isSubscribed = true;

        const initAuth = async () => {
            try {
                // 1. Check Supabase Auth active session
                const { data: { session: currentSession } } = await supabase.auth.getSession();

                if (currentSession?.user) {
                    if (isSubscribed) {
                        setSession(currentSession);
                        setUser(currentSession.user);
                        const hId = await resolveHouseholdId(currentSession.user.id, currentSession.user.email);
                        setHouseholdId(hId);
                        setLoading(false);
                    }
                    return;
                }

                // 2. Fetch Cloudflare Access identity (/api/auth/me)
                const cfUser: CfUser | null = await fetchCfIdentity();

                if (cfUser) {
                    const hId = await resolveHouseholdId(cfUser.id, cfUser.email);
                    const { user: syntheticUser, session: syntheticSession } = createSyntheticSession(cfUser);

                    if (isSubscribed) {
                        setUser(syntheticUser);
                        setSession(syntheticSession);
                        setHouseholdId(hId);
                    }
                } else if (isSubscribed && !initialSessionData) {
                    setUser(null);
                    setSession(null);
                    setHouseholdId(DEFAULT_HOUSEHOLD_ID);
                }
            } catch (err) {
                console.error('Auth initialization error:', err);
                if (isSubscribed) {
                    setHouseholdId(DEFAULT_HOUSEHOLD_ID);
                }
            } finally {
                if (isSubscribed) {
                    setLoading(false);
                }
            }
        };

        initAuth();

        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
            if (newSession?.user && isSubscribed) {
                setSession(newSession);
                setUser(newSession.user);
                const hId = await resolveHouseholdId(newSession.user.id, newSession.user.email);
                setHouseholdId(hId);
            }
        });

        return () => {
            isSubscribed = false;
            subscription.unsubscribe();
        };
    }, []);

    const signOut = async () => {
        setCfUser(null);
        setUser(null);
        setSession(null);
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
