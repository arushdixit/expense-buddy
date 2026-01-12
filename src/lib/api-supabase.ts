import supabase, { DbExpense, DbSubcategory } from './supabase';

// Re-export types for compatibility
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

// Helper to convert DB row to API format
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

// Expense API calls using Supabase
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

    async create(expense: Omit<ApiExpense, 'id' | 'created_at'>): Promise<ApiExpense> {
        const newExpense = {
            id: crypto.randomUUID(),
            amount: expense.amount,
            category: expense.category,
            subcategory: expense.subcategory || null,
            date: expense.date,
            note: expense.note || null,
            updated_at: Date.now(),
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

// Subcategory API calls using Supabase
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
        const { data, error } = await supabase
            .from('subcategories')
            .insert({ category, name })
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

// Statistics API calls using Supabase
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

        // Aggregate manually since Supabase doesn't support GROUP BY directly
        const stats = (data || []).reduce((acc: Record<string, { count: number; total: number; min: number; max: number; amounts: number[] }>, row) => {
            if (!acc[row.category]) {
                acc[row.category] = { count: 0, total: 0, min: Infinity, max: -Infinity, amounts: [] };
            }
            acc[row.category].count++;
            acc[row.category].total += row.amount;
            acc[row.category].min = Math.min(acc[row.category].min, row.amount);
            acc[row.category].max = Math.max(acc[row.category].max, row.amount);
            acc[row.category].amounts.push(row.amount);
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

        // Aggregate by month
        const monthlyStats = (data || []).reduce((acc: Record<string, { count: number; total: number }>, row) => {
            const month = row.date.substring(0, 7); // YYYY-MM
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

// Health check - check Supabase connection
export const healthCheck = async (): Promise<boolean> => {
    try {
        const { error } = await supabase.from('expenses').select('id').limit(1);
        return !error;
    } catch {
        return false;
    }
};
