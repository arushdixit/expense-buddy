/**
 * API Layer - Supabase Backend
 * 
 * This module provides all API functionality using Supabase.
 */

import { supabase, DbExpense } from './supabase';
import { generateId } from './db';

// ----- Types -----

export interface ApiExpense {
    id: string;
    amount: number;
    category: string;
    subcategory?: string;
    date: string;
    note?: string;
    created_at?: string;
    updated_at?: number;
}

export interface ApiSubcategory {
    id: number;
    category: string;
    name: string;
}

export interface ApiCategory {
    id: string;
    name: string;
    color: string;
}

// ----- Helpers -----

const toApiExpense = (row: DbExpense): ApiExpense => ({
    id: row.id,
    amount: row.amount,
    category: row.category,
    subcategory: row.subcategory || undefined,
    date: row.date,
    note: row.note || undefined,
    created_at: row.created_at,
    updated_at: row.updated_at,
});

// ----- Expense API -----

export const expenseApi = {
    async getAll(): Promise<ApiExpense[]> {
        const { data, error } = await supabase
            .from('expenses')
            .select('*')
            .order('date', { ascending: false });

        if (error) throw new Error(`Failed to fetch expenses: ${error.message}`);
        return (data || []).map(toApiExpense);
    },

    async getByDateRange(startDate: string, endDate: string): Promise<ApiExpense[]> {
        const { data, error } = await supabase
            .from('expenses')
            .select('*')
            .gte('date', startDate)
            .lte('date', endDate)
            .order('date', { ascending: false });

        if (error) throw new Error(`Failed to fetch expenses: ${error.message}`);
        return (data || []).map(toApiExpense);
    },

    async getByCategory(category: string): Promise<ApiExpense[]> {
        const { data, error } = await supabase
            .from('expenses')
            .select('*')
            .eq('category', category)
            .order('date', { ascending: false });

        if (error) throw new Error(`Failed to fetch expenses: ${error.message}`);
        return (data || []).map(toApiExpense);
    },

    async getById(id: string): Promise<ApiExpense | null> {
        const { data, error } = await supabase
            .from('expenses')
            .select('*')
            .eq('id', id)
            .maybeSingle();

        if (error) throw new Error(`Failed to fetch expense: ${error.message}`);
        return data ? toApiExpense(data) : null;
    },

    async create(expense: Omit<ApiExpense, 'id' | 'created_at'> & { id?: string; household_id?: string }): Promise<ApiExpense> {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Authentication required');

        let hId = expense.household_id;

        if (!hId) {
            const { data: profile } = await supabase
                .from('profiles')
                .select('household_id')
                .eq('id', user.id)
                .maybeSingle();
            hId = profile?.household_id || null;
        }

        const newExpense = {
            id: expense.id || generateId(),
            amount: expense.amount,
            category: expense.category,
            subcategory: expense.subcategory || null,
            date: expense.date,
            note: expense.note || null,
            updated_at: Date.now(),
            user_id: user.id,
            household_id: hId
        };

        const { data, error } = await supabase
            .from('expenses')
            .insert(newExpense)
            .select()
            .maybeSingle();

        if (error) throw new Error(`Failed to create expense: ${error.message}`);
        if (!data) throw new Error('Failed to create expense: No data returned (check RLS policies)');
        return toApiExpense(data);
    },

    async update(id: string, updates: Partial<ApiExpense>): Promise<ApiExpense> {
        const updateData: Record<string, unknown> = {
            updated_at: Date.now(),
        };

        if (updates.amount !== undefined) updateData.amount = updates.amount;
        if (updates.category !== undefined) updateData.category = updates.category;
        if (updates.subcategory !== undefined) updateData.subcategory = updates.subcategory || null;
        if (updates.date !== undefined) updateData.date = updates.date;
        if (updates.note !== undefined) updateData.note = updates.note || null;

        const { data, error } = await supabase
            .from('expenses')
            .update(updateData)
            .eq('id', id)
            .select()
            .maybeSingle();

        if (error) throw new Error(`Failed to update expense: ${error.message}`);
        if (!data) throw new Error('Failed to update expense: Not found or access denied');
        return toApiExpense(data);
    },

    async delete(id: string): Promise<void> {
        const { error } = await supabase
            .from('expenses')
            .delete()
            .eq('id', id);

        if (error) throw new Error(`Failed to delete expense: ${error.message}`);
    },
};

// ----- Subcategory API -----

export const subcategoryApi = {
    async getAll(): Promise<ApiSubcategory[]> {
        const { data, error } = await supabase
            .from('subcategories')
            .select('*')
            .order('category')
            .order('name');

        if (error) throw new Error(`Failed to fetch subcategories: ${error.message}`);
        return data || [];
    },

    async getByCategory(category: string): Promise<ApiSubcategory[]> {
        const { data, error } = await supabase
            .from('subcategories')
            .select('*')
            .eq('category', category)
            .order('name');

        if (error) throw new Error(`Failed to fetch subcategories: ${error.message}`);
        return data || [];
    },

    async create(category: string, name: string): Promise<ApiSubcategory> {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Authentication required');

        const { data: profile } = await supabase
            .from('profiles')
            .select('household_id')
            .eq('id', user.id)
            .maybeSingle();

        const { data, error } = await supabase
            .from('subcategories')
            .insert({
                category,
                name,
                user_id: user.id,
                household_id: profile?.household_id || null
            })
            .select()
            .maybeSingle();

        if (error) {
            if (error.code === '23505') {
                throw new Error('Subcategory already exists for this category');
            }
            throw new Error(`Failed to create subcategory: ${error.message}`);
        }
        if (!data) throw new Error('Failed to create subcategory: No data returned (check RLS policies)');
        return data;
    },

    async delete(id: number): Promise<void> {
        const { error } = await supabase
            .from('subcategories')
            .delete()
            .eq('id', id);

        if (error) throw new Error(`Failed to delete subcategory: ${error.message}`);
    },
};


// ----- Category API -----

export const categoryApi = {
    async getAll(): Promise<ApiCategory[]> {
        const { data, error } = await supabase
            .from('categories')
            .select('id, name, color')
            .order('name');

        if (error) throw new Error(`Failed to fetch categories: ${error.message}`);
        return data || [];
    },

    async create(name: string, color: string): Promise<ApiCategory> {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Authentication required');

        const { data: profile } = await supabase
            .from('profiles')
            .select('household_id')
            .eq('id', user.id)
            .maybeSingle();

        const { data, error } = await supabase
            .from('categories')
            .insert({
                name,
                color,
                user_id: user.id,
                household_id: profile?.household_id || null
            })
            .select()
            .maybeSingle();

        if (error) {
            if (error.code === '23505') {
                throw new Error('Category already exists');
            }
            throw new Error(`Failed to create category: ${error.message}`);
        }
        if (!data) throw new Error('Failed to create category: No data returned (check RLS policies)');
        return { id: data.id, name: data.name, color: data.color };
    },

    async delete(id: string): Promise<void> {
        const { error } = await supabase
            .from('categories')
            .delete()
            .eq('id', id);

        if (error) throw new Error(`Failed to delete category: ${error.message}`);
    },
};

// ----- Health Check -----

export const healthCheck = async (): Promise<boolean> => true;
