import { createClient } from '@supabase/supabase-js';
import { BaseExpense, BaseSubcategory } from './types';

// Supabase configuration - these are public keys (safe to expose)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Missing Supabase environment variables. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY');
}

// Database types (maps to Supabase table schema)
export interface DbExpense extends Omit<BaseExpense, 'subcategory' | 'note'> {
    subcategory: string | null;
    note: string | null;
    created_at: string;
    updated_at: number;
}

export interface DbSubcategory extends BaseSubcategory { }

// Create Supabase client
export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '');

export default supabase;
