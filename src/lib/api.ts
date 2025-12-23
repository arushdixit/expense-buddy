const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export interface ApiExpense {
  id: string;
  amount: number;
  category: string;
  subcategory?: string;
  date: string;
  note?: string;
  created_at?: string;
}

export interface ApiSubcategory {
  id: number;
  category: string;
  name: string;
}

// Expense API calls
export const expenseApi = {
  async getAll(): Promise<ApiExpense[]> {
    const response = await fetch(`${API_BASE_URL}/expenses`);
    if (!response.ok) throw new Error('Failed to fetch expenses');
    return response.json();
  },

  async getByDateRange(startDate: string, endDate: string): Promise<ApiExpense[]> {
    const response = await fetch(
      `${API_BASE_URL}/expenses/range?startDate=${startDate}&endDate=${endDate}`
    );
    if (!response.ok) throw new Error('Failed to fetch expenses');
    return response.json();
  },

  async getByCategory(category: string): Promise<ApiExpense[]> {
    const response = await fetch(`${API_BASE_URL}/expenses/category/${category}`);
    if (!response.ok) throw new Error('Failed to fetch expenses');
    return response.json();
  },

  async getById(id: string): Promise<ApiExpense> {
    const response = await fetch(`${API_BASE_URL}/expenses/${id}`);
    if (!response.ok) throw new Error('Failed to fetch expense');
    return response.json();
  },

  async create(expense: Omit<ApiExpense, 'id' | 'created_at'>): Promise<ApiExpense> {
    const response = await fetch(`${API_BASE_URL}/expenses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(expense),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create expense');
    }
    return response.json();
  },

  async update(id: string, updates: Partial<ApiExpense>): Promise<ApiExpense> {
    const response = await fetch(`${API_BASE_URL}/expenses/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to update expense');
    }
    return response.json();
  },

  async delete(id: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/expenses/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to delete expense');
    }
  },
};

// Subcategory API calls
export const subcategoryApi = {
  async getAll(): Promise<ApiSubcategory[]> {
    const response = await fetch(`${API_BASE_URL}/subcategories`);
    if (!response.ok) throw new Error('Failed to fetch subcategories');
    return response.json();
  },

  async getByCategory(category: string): Promise<ApiSubcategory[]> {
    const response = await fetch(`${API_BASE_URL}/subcategories/${category}`);
    if (!response.ok) throw new Error('Failed to fetch subcategories');
    return response.json();
  },

  async create(category: string, name: string): Promise<ApiSubcategory> {
    const response = await fetch(`${API_BASE_URL}/subcategories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category, name }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create subcategory');
    }
    return response.json();
  },

  async delete(id: number): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/subcategories/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to delete subcategory');
    }
  },
};

// Statistics API calls
export const statsApi = {
  async getByCategory(startDate?: string, endDate?: string) {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    
    const url = `${API_BASE_URL}/stats/by-category${params.toString() ? '?' + params.toString() : ''}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to fetch statistics');
    return response.json();
  },

  async getMonthly() {
    const response = await fetch(`${API_BASE_URL}/stats/monthly`);
    if (!response.ok) throw new Error('Failed to fetch statistics');
    return response.json();
  },
};

// Health check
export const healthCheck = async (): Promise<boolean> => {
  try {
    const response = await fetch(`${API_BASE_URL}/health`);
    return response.ok;
  } catch {
    return false;
  }
};
