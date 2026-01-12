/**
 * API Layer - Supabase Backend
 * 
 * This module provides the unified API interface using Supabase.
 */

// Re-export everything from the Supabase implementation
export { expenseApi, subcategoryApi, statsApi } from './api-supabase';
export type { ApiExpense, ApiSubcategory } from './api-supabase';

// Health check - always returns true for Supabase (connection handled by Supabase client)
export const healthCheck = async (): Promise<boolean> => true;
