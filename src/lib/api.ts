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

    async getById(id: string): Promise<ApiExpense> {
        const { data, error } = await supabase
            .from('expenses')
            .select('*')
            .eq('id', id)
            .single();

        if (error) throw new Error(`Failed to fetch expense: ${error.message}`);
        return toApiExpense(data);
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
            .single();

        if (error) throw new Error(`Failed to create expense: ${error.message}`);
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
            .single();

        if (error) throw new Error(`Failed to update expense: ${error.message}`);
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
            .single();

        if (error) {
            if (error.code === '23505') {
                throw new Error('Subcategory already exists for this category');
            }
            throw new Error(`Failed to create subcategory: ${error.message}`);
        }
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

// ----- Statistics API -----

export const statsApi = {
    async getByCategory(startDate?: string, endDate?: string) {
        let query = supabase
            .from('expenses')
            .select('category, amount');

        if (startDate && endDate) {
            query = query.gte('date', startDate).lte('date', endDate);
        }

        const { data, error } = await query;

        if (error) throw new Error(`Failed to fetch statistics: ${error.message}`);

        const stats = (data || []).reduce((acc: Record<string, { count: number; total: number; min: number; max: number }>, row) => {
            if (!acc[row.category]) {
                acc[row.category] = { count: 0, total: 0, min: Infinity, max: -Infinity };
            }
            acc[row.category].count++;
            acc[row.category].total += row.amount;
            acc[row.category].min = Math.min(acc[row.category].min, row.amount);
            acc[row.category].max = Math.max(acc[row.category].max, row.amount);
            return acc;
        }, {});

        return Object.entries(stats)
            .map(([category, stat]) => ({
                category,
                count: stat.count,
                total: stat.total,
                average: stat.total / stat.count,
                min: stat.min === Infinity ? 0 : stat.min,
                max: stat.max === -Infinity ? 0 : stat.max,
            }))
            .sort((a, b) => b.total - a.total);
    },

    async getMonthly() {
        const { data, error } = await supabase
            .from('expenses')
            .select('date, amount');

        if (error) throw new Error(`Failed to fetch statistics: ${error.message}`);

        const monthlyStats = (data || []).reduce((acc: Record<string, { count: number; total: number }>, row) => {
            const month = row.date.substring(0, 7);
            if (!acc[month]) {
                acc[month] = { count: 0, total: 0 };
            }
            acc[month].count++;
            acc[month].total += row.amount;
            return acc;
        }, {});

        return Object.entries(monthlyStats)
            .map(([month, stat]) => ({
                month,
                count: stat.count,
                total: stat.total,
            }))
            .sort((a, b) => b.month.localeCompare(a.month));
    },
};

// ----- Health Check -----

export const healthCheck = async (): Promise<boolean> => true;
