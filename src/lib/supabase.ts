import { createClient } from '@supabase/supabase-js';

// Supabase configuration - these are public keys (safe to expose)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Missing Supabase environment variables. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY');
}

// Database types
export interface DbExpense {
    id: string;
    amount: number;
    category: string;
    subcategory: string | null;
    date: string;
    note: string | null;
    created_at: string;
    updated_at: number;
}

export interface DbSubcategory {
    id: number;
    category: string;
    name: string;
}

// Create Supabase client
export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '');

export default supabase;
