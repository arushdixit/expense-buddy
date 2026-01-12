/**
 * API Layer - Unified interface for data access
 * 
 * This module automatically selects the backend:
 * - If VITE_SUPABASE_URL is set: Uses Supabase (production)
 * - Otherwise: Uses Express server (local development)
 */

// Check which backend to use
const useSupabase = !!import.meta.env.VITE_SUPABASE_URL && !!import.meta.env.VITE_SUPABASE_ANON_KEY;

// Import both implementations
import * as supabaseApi from './api-supabase';
import * as expressApi from './api-express';

// Export types
export type { ApiExpense, ApiSubcategory } from './api-supabase';

// Log which backend is being used
if (useSupabase) {
  console.log('🚀 Using Supabase backend');
} else {
  console.log('🔧 Using Express backend');
}

// Export the selected implementation
export const expenseApi = useSupabase ? supabaseApi.expenseApi : expressApi.expenseApi;
export const subcategoryApi = useSupabase ? supabaseApi.subcategoryApi : expressApi.subcategoryApi;
export const statsApi = useSupabase ? supabaseApi.statsApi : expressApi.statsApi;
export const healthCheck = useSupabase ? supabaseApi.healthCheck : expressApi.healthCheck;
