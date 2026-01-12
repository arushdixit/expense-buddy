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
            // Use maybeSingle to avoid 406 error if record is missing
            let { data, error } = await supabase
                .from('profiles')
                .select('household_id')
                .eq('id', userId)
                .maybeSingle();

            if (error) {
                console.error('Error fetching profile:', error.message);
                return;
            }

            if (!data) {
                // Profile missing! Let's create it.
                console.log('Profile missing, creating one...');

                // Get first household or create one
                let { data: household } = await supabase.from('households').select('id').limit(1).maybeSingle();

                let hId = household?.id;

                if (!hId) {
                    const { data: newH } = await supabase.from('households').insert({ name: 'Our Home' }).select().maybeSingle();
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

                if (!createError && newProfile) {
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
        // Check active sessions and sets the user
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            setUser(session?.user ?? null);
            if (session?.user) fetchHouseholdId(session.user.id, session.user.email);
            setLoading(false);
        });

        // Listen for changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
            setUser(session?.user ?? null);
            if (session?.user) {
                fetchHouseholdId(session.user.id, session.user.email);
            } else {
                setHouseholdId(null);
            }
            setLoading(false);
        });

        return () => subscription.unsubscribe();
    }, []);

    const signOut = async () => {
        await supabase.auth.signOut();
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
