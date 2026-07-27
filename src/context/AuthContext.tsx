import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Session, User } from '@supabase/supabase-js';
import { fetchCfIdentity, setCfUser, CfUser } from '@/lib/cfAuth';

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
            // First check by ID or email in profiles
            let query = supabase.from('profiles').select('household_id');
            if (email) {
                query = query.or(`id.eq.${userId},email.eq.${email}`);
            } else {
                query = query.eq('id', userId);
            }

            const { data, error } = await query.maybeSingle();

            if (error) {
                console.error('Error fetching profile:', error.message);
            }

            if (!data) {
                // Profile missing - create or assign household
                let { data: household } = await supabase.from('households').select('id').limit(1).maybeSingle();
                let hId = household?.id;

                if (!hId) {
                    const { data: newH, error: hError } = await supabase.from('households').insert({ name: 'Our Home' }).select().maybeSingle();
                    if (hError) console.error('Failed to create household:', hError.message);
                    hId = newH?.id;
                }

                const { data: newProfile, error: createError } = await supabase
                    .from('profiles')
                    .insert({
                        id: userId,
                        email: email,
                        household_id: hId || null
                    })
                    .select()
                    .maybeSingle();

                if (createError) {
                    console.error('Failed to create profile:', createError.message);
                } else if (newProfile) {
                    setHouseholdId(newProfile.household_id);
                }
            } else {
                setHouseholdId(data.household_id);
            }
        } catch (err) {
            console.error('Error in fetchHouseholdId:', err);
        }
    };

    useEffect(() => {
        const initAuth = async () => {
            try {
                // Fetch Cloudflare Access identity
                const cfUser: CfUser | null = await fetchCfIdentity();

                if (cfUser) {
                    const syntheticUser: User = {
                        id: cfUser.id,
                        app_metadata: { provider: 'cloudflare_google_oauth' },
                        user_metadata: { name: cfUser.name, email: cfUser.email },
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

                    setUser(syntheticUser);
                    setSession(syntheticSession);
                    await fetchHouseholdId(cfUser.id, cfUser.email);
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
        // Redirect to Cloudflare Access logout URL
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

